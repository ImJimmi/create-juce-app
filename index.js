#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import child_process from "node:child_process";
import os from "node:os";
import prompts from "prompts";

let config = {};

const templatesDir = path.join(import.meta.dirname, "templates");
let relativeSourceDir = "";
let projectDir = "";
let projectSourceDir = "";
let projectCMakeLists = "";
let testsCMakeLists = "";

const dotEnvFile = path.join(process.cwd(), ".env");
if (fs.existsSync(dotEnvFile)) {
  process.loadEnvFile(dotEnvFile);
}

function getArgValue(argPrefix) {
  return process.argv
    .find((arg) => arg.startsWith(argPrefix))
    ?.slice(argPrefix.length);
}

const githubTokenArg = "--github-token=";
const githubToken =
  getArgValue(githubTokenArg) ??
  process.env.GITHUB_TOKEN ??
  process.env.GH_TOKEN;

const configFile = getArgValue("--config=");
const dumpFile = getArgValue("--dump=");

if (configFile) {
  config = JSON.parse(
    fs.readFileSync(path.resolve(configFile), { encoding: "utf-8" }),
  );
}

async function fetchGitHubJson(url) {
  const response = await fetch(url, {
    headers: githubToken ? { Authorization: `Bearer ${githubToken}` } : {},
  });

  if (!response.ok) {
    throw new Error(
      response.status === 403 || response.status === 429
        ? `GitHub rate limit reached - provide a personal access token using ${githubTokenArg}<token>, $GITHUB_TOKEN, or $GH_TOKEN`
        : `Request to ${url} failed with ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

async function promptUser(promptObject) {
  if (promptObject.name in config) {
    return;
  }

  if (typeof promptObject.choices === "function") {
    promptObject = { ...promptObject, choices: await promptObject.choices() };
  }

  config = {
    ...config,
    ...(await prompts([promptObject], { onCancel: () => process.exit(1) })),
  };
}

function dumpConfig() {
  const file = path.resolve(dumpFile);
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf-8",
  });
  console.log(`Config written to ${file}`);
}

function toKebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
function toTitleCase(value) {
  return `${value[0].toUpperCase()}${value.substring(1, value.length)}`;
}

function setVar(file, varName, value) {
  fs.writeFileSync(
    file,
    fs
      .readFileSync(file, { encoding: "utf8" })
      .replaceAll(`VAR_${varName}`, value),
    { encoding: "utf8" },
  );
}

function clearUnsetVars(file) {
  fs.writeFileSync(
    file,
    fs
      .readFileSync(file, { encoding: "utf8" })
      .replace(/^.*VAR_.*\r?\n?/gm, ""),
    { encoding: "utf8" },
  );
}

function appendToCpmPackageLock(entry) {
  const file = path.join(projectDir, "cpm-package-lock.cmake");
  fs.writeFileSync(
    file,
    `${fs.readFileSync(file, { encoding: "utf-8" })}${entry}\n`,
    {
      encoding: "utf-8",
    },
  );
}

async function makeInitialProjectDir() {
  await promptUser({
    type: "text",
    name: "projectName",
    message: "What is the name of your project?",
    initial: "My JUCE Project",
  });
  await promptUser({
    type: "text",
    name: "companyName",
    message: "What's your company/brand name?",
    initial: "My Company",
  });
  await promptUser({
    type: "text",
    name: "projectID",
    message: "What should we call the project folder?",
    initial: toKebabCase(config.projectName),
  });

  projectDir = path.join(process.cwd(), config.projectID);
  relativeSourceDir = path.join("source", config.projectID);
  projectSourceDir = path.join(projectDir, relativeSourceDir);

  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir);
  } else if (fs.readdirSync(projectDir).length > 0) {
    const result = await prompts([
      {
        type: "toggle",
        name: "delete",
        message: `${config.projectID}/ already exists - empty the folder?`,
        initial: false,
        active: "Empty folder",
        inactive: "Cancel",
      },
    ]);

    if (result.delete) {
      fs.rmSync(projectDir, { recursive: true, force: true });
      fs.mkdirSync(projectDir);
    } else {
      return 1;
    }
  }

  fs.mkdirSync(projectSourceDir, { recursive: true });

  await promptUser({
    type: "toggle",
    name: "initGit",
    message: "Initialise git?",
    initial: true,
    active: "Yes (recommended)",
    inactive: "No",
  });

  if (config.initGit) {
    console.log(
      child_process.execSync("git init && git branch -m main", {
        cwd: projectDir,
        encoding: "utf-8",
      }),
    );

    fs.writeFileSync(
      path.join(projectDir, ".gitignore"),
      "build/\nCPM_modules/",
    );
    fs.copyFileSync(
      path.join(import.meta.dirname, ".clang-format"),
      path.join(projectDir, ".clang-format"),
    );
  }

  return 0;
}

async function collectJuceVersions() {
  const message = "Fetching available JUCE versions…";
  process.stdout.write(message);

  let releases = (
    await fetchGitHubJson(
      "https://api.github.com/repos/juce-framework/JUCE/releases",
    )
  ).map((release) => ({ title: release.name, value: release.tag_name }));

  releases = releases.filter(
    (release) => Number.parseInt(release.value[0]) >= 8,
  );
  releases[0].title = releases[0].title + " (recommended)";
  releases.splice(1, 0, { title: "Master branch", value: "master" });
  releases.splice(2, 0, { title: "Develop branch", value: "develop" });

  process.stdout.write("\r" + " ".repeat(message.length) + "\r");

  return releases;
}

async function fetchLatestCPM() {
  const message = "Fetching latest CPM.cmake…";
  process.stdout.write(message);

  const latestRelease = await fetchGitHubJson(
    "https://api.github.com/repos/cpm-cmake/cpm.cmake/releases/latest",
  );
  const assets = await fetchGitHubJson(latestRelease.assets_url);
  const getCPMAsset = assets.find((asset) => asset.name === "get_cpm.cmake");
  const response = await fetch(getCPMAsset.browser_download_url);
  const getCPMFile = path.join(os.tmpdir(), "get_cpm.cmake");
  fs.writeFileSync(getCPMFile, await response.text(), {
    encoding: "utf-8",
  });
  child_process.execSync(
    `cmake -DCPM_PATH="${path.join(projectDir, "cmake")}" -DCPM_SOURCE_CACHE=${os.homedir()}/.cache/CPM -P ${getCPMFile}`,
    {
      cwd: projectDir,
    },
  );

  process.stdout.write("\r" + " ".repeat(message.length) + "\r");
}

async function addJuceDependency() {
  let dependencyChoices = [
    { title: "Using CPM (recommended)", value: "cpm" },
    { title: "Using FetchContent", value: "fetchContent" },
  ];

  if (config.initGit) {
    dependencyChoices.push({
      title: "As a git submodule",
      value: "submodule",
    });
  }

  await promptUser({
    type: "select",
    name: "dependencyType",
    message: "How do you want to add JUCE and other dependencies?",
    choices: dependencyChoices,
  });

  if (config.dependencyType === "cpm") {
    await fetchLatestCPM();
    setVar(
      projectCMakeLists,
      "INIT_CPM",
      `if(NOT CPM_SOURCE_CACHE)\n    set(CPM_SOURCE_CACHE "\$ENV{HOME}/.cache/CPM")\nendif()\n\ninclude(CPM)\nCPMUsePackageLock(cpm-package-lock.cmake)`,
    );
  }

  await promptUser({
    type: "select",
    name: "juceVersion",
    message: "Which version of JUCE?",
    choices: collectJuceVersions,
  });

  if (config.dependencyType === "cpm") {
    appendToCpmPackageLock(
      `CPMDeclarePackage(JUCE\n    GITHUB_REPOSITORY juce-framework/JUCE\n    GIT_TAG ${config.juceVersion}\n    SYSTEM YES\n    EXCLUDE_FROM_ALL YES\n)`,
    );
    setVar(projectCMakeLists, "ADD_JUCE_DEPENDENCY", `CPMGetPackage(JUCE)`);
  } else if (config.dependencyType === "fetchContent") {
    setVar(
      projectCMakeLists,
      "ADD_JUCE_DEPENDENCY",
      `include(FetchContent)\n\nmessage(STATUS "Fetching JUCE...")\nFetchContent_Declare(JUCE\n    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git\n    GIT_TAG ${config.juceVersion}\n    GIT_SHALLOW TRUE\n)\nFetchContent_MakeAvailable(JUCE)`,
    );
  } else if (config.dependencyType === "submodule") {
    fs.mkdirSync(path.join(projectDir, "submodules"));

    const message = "Cloning JUCE…";
    process.stdout.write(message);
    child_process.execSync(
      "git submodule add https://github.com/juce-framework/JUCE.git ./submodules/JUCE",
      { cwd: projectDir, stdio: "pipe" },
    );
    child_process.execSync(`git checkout ${config.juceVersion}`, {
      cwd: path.join(projectDir, "submodules", "JUCE"),
      stdio: "pipe",
    });
    process.stdout.write("\r" + " ".repeat(message.length) + "\r");

    setVar(
      projectCMakeLists,
      "ADD_JUCE_DEPENDENCY",
      "add_subdirectory(submodules/JUCE)",
    );
  }
}

// Maps an effect category onto the equivalent category for each plugin format that supports
// finer-grained categorisation than a plain "effect". VST2 and AAX have no equivalent for some
// categories, in which case `vst2`/`aax` is left at its format's default and omitted below.
const pluginEffectCategories = {
  dynamics: { vst3: "Dynamics", vst2: "kPlugCategEffect", aax: "Dynamics" },
  eq: { vst3: "EQ", vst2: "kPlugCategEffect", aax: "EQ" },
  filter: { vst3: "Filter", vst2: "kPlugCategEffect", aax: null },
  distortion: {
    vst3: "Distortion",
    vst2: "kPlugCategEffect",
    aax: "Harmonic",
  },
  delay: { vst3: "Delay", vst2: "kPlugCategEffect", aax: "Delay" },
  reverb: { vst3: "Reverb", vst2: "kPlugCategRoomFx", aax: "Reverb" },
  modulation: {
    vst3: "Modulation",
    vst2: "kPlugCategEffect",
    aax: "Modulation",
  },
  pitchShift: {
    vst3: "Pitch Shift",
    vst2: "kPlugCategEffect",
    aax: "PitchShift",
  },
  restoration: {
    vst3: "Restoration",
    vst2: "kPlugCategRestoration",
    aax: "NoiseReduction",
  },
  analyzer: { vst3: "Analyzer", vst2: "kPlugCategAnalysis", aax: null },
  spatial: {
    vst3: "Spatial",
    vst2: "kPlugCategSpacializer",
    aax: "SoundField",
  },
  mastering: { vst3: "Mastering", vst2: "kPlugCategMastering", aax: null },
  tools: { vst3: "Tools", vst2: "kPlugCategEffect", aax: null },
  generator: { vst3: "Generator", vst2: "kPlugCategGenerator", aax: null },
};

function quoteIfContainsSpace(value) {
  return value.includes(" ") ? `"${value}"` : value;
}

async function makeInitialCMakeProject() {
  projectCMakeLists = path.join(projectDir, "CMakeLists.txt");
  fs.copyFileSync(path.join(templatesDir, "CMakeLists.txt"), projectCMakeLists);
  const bundleId = `com.${toKebabCase(config.companyName)}.${config.projectID}`;

  setVar(projectCMakeLists, "PROJECT_ID", config.projectID);
  setVar(projectCMakeLists, "PROJECT_NAME", config.projectName);
  setVar(projectCMakeLists, "COMPANY_NAME", config.companyName);
  setVar(projectCMakeLists, "BUNDLE_ID", `BUNDLE_ID "${bundleId}"`);

  fs.mkdirSync(path.join(projectDir, "cmake"));
  fs.copyFileSync(
    path.join(templatesDir, "CommonConfig.cmake"),
    path.join(projectDir, "cmake", "CommonConfig.cmake"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "ClangTidy.cmake"),
    path.join(projectDir, "cmake", "ClangTidy.cmake"),
  );
  fs.copyFileSync(
    path.join(import.meta.dirname, ".clang-tidy"),
    path.join(projectDir, ".clang-tidy"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "CppCheck.cmake"),
    path.join(projectDir, "cmake", "CppCheck.cmake"),
  );

  const assetsDir = path.join(projectDir, "assets");
  fs.mkdirSync(assetsDir);
  fs.cpSync(
    path.join(templatesDir, "macOS_icon.icon"),
    path.join(assetsDir, "AppIcon.icon"),
    { recursive: true },
  );
  fs.copyFileSync(
    path.join(templatesDir, "Icon-512x.png"),
    path.join(assetsDir, "Icon-512x.png"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "Icon-256x.png"),
    path.join(assetsDir, "Icon-256x.png"),
  );

  const installerDir = path.join(projectDir, "installer");
  fs.mkdirSync(installerDir);
  fs.copyFileSync(
    path.join(templatesDir, "License.rtf"),
    path.join(installerDir, "License.rtf"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "ReadMe.rtf"),
    path.join(installerDir, "ReadMe.rtf"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "Installers.cmake"),
    path.join(projectDir, "cmake", "Installers.cmake"),
  );

  const workflowsDir = path.join(projectDir, ".github", "workflows");
  fs.mkdirSync(workflowsDir, { recursive: true });
  fs.copyFileSync(
    path.join(templatesDir, "github-workflows-build.yml"),
    path.join(workflowsDir, "build.yml"),
  );

  const installDependenciesActionDir = path.join(
    projectDir,
    ".github",
    "actions",
    "install-dependencies",
  );
  fs.mkdirSync(installDependenciesActionDir, { recursive: true });
  fs.copyFileSync(
    path.join(templatesDir, "github-actions-install-dependencies.yml"),
    path.join(installDependenciesActionDir, "action.yml"),
  );

  const importSigningCertificatesActionDir = path.join(
    projectDir,
    ".github",
    "actions",
    "import-signing-certificates",
  );
  fs.mkdirSync(importSigningCertificatesActionDir, { recursive: true });
  fs.copyFileSync(
    path.join(templatesDir, "github-actions-import-signing-certificates.yml"),
    path.join(importSigningCertificatesActionDir, "action.yml"),
  );

  await addJuceDependency();

  await promptUser({
    type: "select",
    name: "projectType",
    message: "What type of project are you building?",
    choices: [
      { title: "Audio Plugin", value: "plugin" },
      { title: "Desktop App", value: "desktop" },
      { title: "Console App", value: "console" },
    ],
  });

  if (config.projectType === "plugin") {
    await promptUser({
      type: "text",
      name: "pluginCode",
      message: "What should the plugin code be?",
      validate: (code) => {
        if (code.length === 4 && code[0].toUpperCase() === code[0]) return true;

        return "Plugin Code must be 4 letters and start with an upper-case letter";
      },
      initial: `${toTitleCase(config.projectName.replace(/\W/g, "").substring(0, 4))}`,
    });
    await promptUser({
      type: "text",
      name: "pluginManufacturerCode",
      message: "What's your manufacturer code?",
      validate: (code) => {
        if (code.length === 4 && code[0].toUpperCase() === code[0]) return true;

        return "Manufacturer Code must be 4 letters and start with an upper-case letter";
      },
      initial: `${toTitleCase(config.companyName.replace(/\W/g, "").substring(0, 4))}`,
    });
    await promptUser({
      type: "multiselect",
      name: "pluginFormats",
      message: "Which plugin formats does your project support?",
      min: 1,
      choices: [
        { title: "AU", value: "AU", selected: true },
        { title: "Standalone", value: "Standalone", selected: true },
        { title: "VST3", value: "VST3", selected: true },
        { title: "AAX", value: "AAX" },
        { title: "AUv3", value: "AUv3" },
        { title: "LV2", value: "LV2" },
        { title: "Unity", value: "Unity" },
        { title: "VST", value: "VST" },
      ],
    });

    if (config.pluginFormats.includes("VST")) {
      await promptUser({
        type: "text",
        name: "vst2SdkPath",
        message:
          "Where's your VST2 SDK? (Steinberg no longer distributes this - you'll need your own copy)",
      });
    }

    await promptUser({
      type: "select",
      name: "pluginType",
      message:
        "What type of plugin are you building? (used to categorise it in VST3, AU, AAX, and VST hosts)",
      choices: [
        { title: "Effect", value: "fx" },
        { title: "Synth (Instrument)", value: "synth" },
        { title: "MIDI Effect (MIDI-only, no audio)", value: "midiEffect" },
      ],
    });

    if (config.pluginType !== "midiEffect") {
      await promptUser({
        type: "multiselect",
        name: "midiIO",
        message: "Does your plugin use MIDI?",
        choices: [
          {
            title: "Accepts MIDI input",
            value: "needsMidiInput",
            selected: config.pluginType === "synth",
          },
          { title: "Produces MIDI output", value: "needsMidiOutput" },
        ],
      });
    }

    if (config.pluginType === "fx") {
      await promptUser({
        type: "select",
        name: "pluginEffectCategory",
        message:
          "What category best describes your effect? (used to sort it in VST3 and AAX host browsers)",
        choices: [
          { title: "General / Other", value: "none" },
          {
            title: "Dynamics (compressor, limiter, gate, etc.)",
            value: "dynamics",
          },
          { title: "EQ", value: "eq" },
          { title: "Filter", value: "filter" },
          { title: "Distortion / Saturation", value: "distortion" },
          { title: "Delay", value: "delay" },
          { title: "Reverb", value: "reverb" },
          {
            title: "Modulation (chorus, flanger, phaser, etc.)",
            value: "modulation",
          },
          { title: "Pitch Shift", value: "pitchShift" },
          {
            title: "Restoration (noise reduction, de-clicking, etc.)",
            value: "restoration",
          },
          { title: "Analyzer", value: "analyzer" },
          { title: "Spatial / Surround", value: "spatial" },
          { title: "Mastering", value: "mastering" },
          { title: "Tools / Utility", value: "tools" },
          { title: "Generator", value: "generator" },
        ],
      });
    }

    await promptUser({
      type: "select",
      name: "dspAPI",
      message: "Which DSP API do you want to use?",
      choices: [
        { title: "Basic JUCE audio API", value: "basic" },
        { title: "juce_dsp module", value: "juce_dsp" },
      ],
    });
  }

  if (config.projectType !== "console") {
    await promptUser({
      type: "select",
      name: "guiAPI",
      message: "Which GUI API should your project use?",
      choices: [
        { title: "Traditional JUCE Components", value: "component" },
        { title: "Web front-end", value: "webview" },
        { title: "JIVE", value: "jive" },
      ],
    });

    if (config.guiAPI === "webview") {
      setVar(
        projectCMakeLists,
        "NEEDS_WEB_BROWSER",
        "NEEDS_WEB_BROWSER TRUE\n    NEEDS_WEBVIEW2 TRUE",
      );

      await promptUser({
        type: "select",
        name: "webFramework",
        message: "Which framework do you want to use?",
        choices: [
          { title: "Vanilla", value: "vanilla" },
          { title: "Vue", value: "vue" },
          { title: "React", value: "react" },
          { title: "Preact", value: "preact" },
          { title: "Lit", value: "lit" },
          { title: "Svelte", value: "svelte" },
          { title: "Solid", value: "solid" },
          { title: "Qwik", value: "qwik" },
        ],
      });
      await promptUser({
        type: "select",
        name: "webLanguage",
        message: "Which language do you want to use?",
        choices: [
          { title: "Typescript", value: "typescript" },
          { title: "JavaScript", value: "javascript" },
        ],
      });

      child_process.execSync(
        `npm create vite@latest frontend -- --template ${config.webFramework}${config.webLanguage === "typescript" ? "-ts" : ""} --no-immediate --no-interactive`,
        { cwd: projectDir, stdio: "ignore" },
      );

      // Release builds run `npm ci` (see WebFrontend.cmake), which requires
      // a lockfile, so generate one now rather than leaving it to be
      // generated (or fail) on the first Release build.
      child_process.execSync("npm install --package-lock-only", {
        cwd: path.join(projectDir, "frontend"),
        stdio: "ignore",
      });
    }
  }

  if (config.projectType === "plugin") {
    const isSynth = config.pluginType === "synth";
    const isMidiEffect = config.pluginType === "midiEffect";
    const needsMidiInput =
      isMidiEffect || config.midiIO.includes("needsMidiInput");
    const needsMidiOutput =
      isMidiEffect || config.midiIO.includes("needsMidiOutput");

    setVar(projectCMakeLists, "JUCE_ADD_TARGET_FUNCTION", "juce_add_plugin");
    setVar(
      projectCMakeLists,
      "PLUGIN_CODE",
      `PLUGIN_CODE "${config.pluginCode}"`,
    );
    setVar(
      projectCMakeLists,
      "PLUGIN_MANUFACTURER_CODE",
      `PLUGIN_MANUFACTURER_CODE "${config.pluginManufacturerCode}"`,
    );
    setVar(
      projectCMakeLists,
      "PLUGIN_FORMATS",
      `FORMATS ${config.pluginFormats.join(" ")}`,
    );
    if (config.pluginFormats.includes("VST")) {
      setVar(
        projectCMakeLists,
        "VST2_SDK_PATH",
        `juce_set_vst2_sdk_path("${config.vst2SdkPath}")`,
      );
    }
    if (config.pluginFormats.includes("LV2")) {
      setVar(projectCMakeLists, "LV2_URI", `LV2URI "urn:${bundleId}"`);
    }
    const pluginCharacteristics = [
      isSynth && "IS_SYNTH TRUE",
      needsMidiInput && "NEEDS_MIDI_INPUT TRUE",
      needsMidiOutput && "NEEDS_MIDI_OUTPUT TRUE",
      isMidiEffect && "IS_MIDI_EFFECT TRUE",
    ].filter(Boolean);

    if (pluginCharacteristics.length > 0) {
      setVar(
        projectCMakeLists,
        "PLUGIN_CHARACTERISTICS",
        pluginCharacteristics.join("\n    "),
      );
    }

    const effectCategory = pluginEffectCategories[config.pluginEffectCategory];
    if (effectCategory) {
      const pluginCategories = [
        `VST3_CATEGORIES Fx ${quoteIfContainsSpace(effectCategory.vst3)}`,
        effectCategory.vst2 !== "kPlugCategEffect" &&
          `VST2_CATEGORY ${effectCategory.vst2}`,
        effectCategory.aax && `AAX_CATEGORY ${effectCategory.aax}`,
      ].filter(Boolean);

      setVar(
        projectCMakeLists,
        "PLUGIN_CATEGORIES",
        pluginCategories.join("\n    "),
      );
    }
    setVar(
      projectCMakeLists,
      "ICONS",
      'ICON_BIG "${PROJECT_SOURCE_DIR}/assets/Icon-512x.png"\n    ICON_SMALL "${PROJECT_SOURCE_DIR}/assets/Icon-256x.png"',
    );

    fs.copyFileSync(
      path.join(templatesDir, "plugin-create-plugin-filter.cpp"),
      path.join(projectSourceDir, "CreatePluginFilter.cpp"),
    );
    setVar(
      path.join(projectSourceDir, "CreatePluginFilter.cpp"),
      "PROJECT_ID",
      config.projectID,
    );

    fs.copyFileSync(
      path.join(templatesDir, "plugin-processor.h"),
      path.join(projectSourceDir, "Processor.h"),
    );
    setVar(
      path.join(projectSourceDir, "Processor.h"),
      "PROJECT_ID",
      config.projectID,
    );
    setVar(
      path.join(projectSourceDir, "Processor.h"),
      "NEEDS_MIDI_INPUT",
      needsMidiInput ? "true" : "false",
    );
    setVar(
      path.join(projectSourceDir, "Processor.h"),
      "NEEDS_MIDI_OUTPUT",
      needsMidiOutput ? "true" : "false",
    );
    setVar(
      path.join(projectSourceDir, "Processor.h"),
      "IS_MIDI_EFFECT",
      isMidiEffect ? "true" : "false",
    );

    fs.mkdirSync(path.join(projectSourceDir, "audio"));
    if (config.dspAPI === "basic") {
      fs.copyFileSync(
        path.join(templatesDir, "plugin-main-audio-processor-basic.h"),
        path.join(projectSourceDir, "audio", "MainAudioProcessor.h"),
      );
      setVar(
        path.join(projectSourceDir, "Processor.h"),
        "PREPARE_TO_PLAY_IMPL",
        "mainAudioProcessor = std::make_unique<MainAudioProcessor>(sampleRate,\n                                                                  expectedBlockSize,\n                                                                  getMainBusNumOutputChannels(),\n                                                                  apvts);",
      );
      setVar(
        path.join(projectSourceDir, "Processor.h"),
        "PROCESS_BLOCK_IMPL",
        "mainAudioProcessor->processBlock(buffer);",
      );
    } else if (config.dspAPI === "juce_dsp") {
      fs.copyFileSync(
        path.join(templatesDir, "plugin-main-audio-processor-juce_dsp.h"),
        path.join(projectSourceDir, "audio", "MainAudioProcessor.h"),
      );
      setVar(
        path.join(projectSourceDir, "Processor.h"),
        "PREPARE_TO_PLAY_IMPL",
        "const juce::dsp::ProcessSpec spec{\n            sampleRate,\n            static_cast<juce::uint32>(expectedBlockSize),\n            static_cast<juce::uint32>(getMainBusNumOutputChannels()),\n        };\n        mainAudioProcessor = std::make_unique<MainAudioProcessor>(spec, apvts);",
      );
      setVar(
        path.join(projectSourceDir, "Processor.h"),
        "PROCESS_BLOCK_IMPL",
        "juce::dsp::AudioBlock<float> block{ buffer };\n        const juce::dsp::ProcessContextReplacing context{ block };\n        mainAudioProcessor->process(context);",
      );
    }

    fs.copyFileSync(
      path.join(templatesDir, "plugin-parameters.h"),
      path.join(projectSourceDir, "audio", "Parameters.h"),
    );
    fs.mkdirSync(path.join(projectSourceDir, "editor"));
    setVar(
      projectCMakeLists,
      "SOURCES",
      path.join(
        "${PROJECT_SOURCE_DIR}",
        relativeSourceDir,
        "CreatePluginFilter.cpp",
      ),
    );
    setVar(projectCMakeLists, "LINK_LIBRARIES", "juce::juce_audio_utils");

    if (config.guiAPI === "component") {
      fs.copyFileSync(
        path.join(templatesDir, "plugin-editor-JUCE.h"),
        path.join(projectSourceDir, "editor", "Editor.h"),
      );
      setVar(
        path.join(projectSourceDir, "editor", "Editor.h"),
        "PROJECT_ID",
        config.projectID,
      );
    } else if (config.guiAPI === "webview") {
      fs.copyFileSync(
        path.join(templatesDir, "plugin-editor-webview.h"),
        path.join(projectSourceDir, "editor", "Editor.h"),
      );
      fs.copyFileSync(
        path.join(templatesDir, "SinglePageBrowserComponent.h"),
        path.join(projectSourceDir, "editor", "SinglePageBrowserComponent.h"),
      );
      fs.copyFileSync(
        path.join(templatesDir, "SinglePageBrowserComponent.mm"),
        path.join(projectSourceDir, "editor", "SinglePageBrowserComponent.mm"),
      );

      fs.copyFileSync(
        path.join(templatesDir, "WebFrontend.cmake"),
        path.join(projectDir, "cmake", "WebFrontend.cmake"),
      );
      setVar(
        path.join(projectDir, "cmake", "WebFrontend.cmake"),
        "PROJECT_ID",
        config.projectID,
      );
      setVar(
        path.join(projectDir, "cmake", "WebFrontend.cmake"),
        "GUI_DIR",
        "editor",
      );
      setVar(
        projectCMakeLists,
        "ADD_WEB_FRONTEND",
        `include(WebFrontend)\nadd_web_frontend(${config.projectID})\n`,
      );
    }
  } else if (config.projectType === "desktop") {
    setVar(projectCMakeLists, "JUCE_ADD_TARGET_FUNCTION", "juce_add_gui_app");
    setVar(
      projectCMakeLists,
      "ICONS",
      'ICON_BIG "${PROJECT_SOURCE_DIR}/assets/Icon-512x.png"\n    ICON_SMALL "${PROJECT_SOURCE_DIR}/assets/Icon-256x.png"\n    ICON_COMPOSER_BUNDLE "${PROJECT_SOURCE_DIR}/assets/AppIcon.icon"',
    );

    fs.copyFileSync(
      path.join(templatesDir, "gui-app-main.cpp"),
      path.join(projectSourceDir, "main.cpp"),
    );
    setVar(
      path.join(projectSourceDir, "main.cpp"),
      "PROJECT_ID",
      config.projectID,
    );
    fs.mkdirSync(path.join(projectSourceDir, "gui"));
    fs.copyFileSync(
      path.join(templatesDir, "gui-app-window.h"),
      path.join(projectSourceDir, "gui", "Window.h"),
    );
    setVar(
      projectCMakeLists,
      "SOURCES",
      path.join("${PROJECT_SOURCE_DIR}", relativeSourceDir, "main.cpp"),
    );

    if (config.guiAPI === "component") {
      fs.copyFileSync(
        path.join(templatesDir, "gui-app-main-component-JUCE.h"),
        path.join(projectSourceDir, "gui", "MainComponent.h"),
      );

      setVar(projectCMakeLists, "COMPILE_DEFINITIONS", "JUCE_WEB_BROWSER=0");
      setVar(projectCMakeLists, "LINK_LIBRARIES", "juce::juce_gui_basics");
    } else if (config.guiAPI === "webview") {
      fs.copyFileSync(
        path.join(templatesDir, "SinglePageBrowserComponent.h"),
        path.join(projectSourceDir, "gui", "SinglePageBrowserComponent.h"),
      );
      fs.copyFileSync(
        path.join(templatesDir, "SinglePageBrowserComponent.mm"),
        path.join(projectSourceDir, "gui", "SinglePageBrowserComponent.mm"),
      );
      fs.copyFileSync(
        path.join(templatesDir, "gui-app-main-component-webview.h"),
        path.join(projectSourceDir, "gui", "MainComponent.h"),
      );
      fs.copyFileSync(
        path.join(templatesDir, "WebFrontend.cmake"),
        path.join(projectDir, "cmake", "WebFrontend.cmake"),
      );
      setVar(
        path.join(projectDir, "cmake", "WebFrontend.cmake"),
        "PROJECT_ID",
        config.projectID,
      );
      setVar(
        path.join(projectDir, "cmake", "WebFrontend.cmake"),
        "GUI_DIR",
        "gui",
      );

      setVar(projectCMakeLists, "COMPILE_DEFINITIONS", "JUCE_WEB_BROWSER=1");
      setVar(projectCMakeLists, "LINK_LIBRARIES", "juce::juce_gui_extra");
      setVar(
        projectCMakeLists,
        "ADD_WEB_FRONTEND",
        `include(WebFrontend)\nadd_web_frontend(${config.projectID})\n`,
      );
    }
  } else if (config.projectType === "console") {
    setVar(
      projectCMakeLists,
      "JUCE_ADD_TARGET_FUNCTION",
      "juce_add_console_app",
    );

    fs.copyFileSync(
      path.join(templatesDir, "console-main.cpp"),
      path.join(projectSourceDir, "main.cpp"),
    );
    setVar(
      projectCMakeLists,
      "SOURCES",
      path.join("${PROJECT_SOURCE_DIR}", relativeSourceDir, "main.cpp"),
    );

    setVar(projectCMakeLists, "LINK_LIBRARIES", "juce::juce_core");
  }

  return 0;
}

function addDependencyCatch2() {
  if (config.dependencyType === "cpm") {
    appendToCpmPackageLock(
      "CPMDeclarePackage(Catch2\n    GITHUB_REPOSITORY catchorg/Catch2\n    GIT_TAG v3.16.0\n    SYSTEM YES\n    EXCLUDE_FROM_ALL YES\n)",
    );
    setVar(
      testsCMakeLists,
      "ADD_CATCH2",
      "CPMGetPackage(Catch2)\ninclude(${Catch2_SOURCE_DIR}/extras/Catch.cmake)",
    );
  } else if (config.dependencyType === "fetchContent") {
    setVar(
      testsCMakeLists,
      "ADD_CATCH2",
      'message(STATUS "Fetching Catch2...")\nFetchContent_Declare(Catch2\n    GIT_REPOSITORY https://github.com/catchorg/Catch2.git\n    GIT_TAG v3.15.3\n    GIT_SHALLOW TRUE\n)\nFetchContent_MakeAvailable(Catch2)\ninclude(${Catch2_SOURCE_DIR}/extras/Catch.cmake)',
    );
  } else if (config.dependencyType === "submodule") {
    const message = "Cloning Catch2…";
    process.stdout.write(message);
    child_process.execSync(
      "git submodule add https://github.com/catchorg/Catch2.git ./submodules/Catch2",
      { cwd: projectDir },
    );
    process.stdout.write("\r" + " ".repeat(message.length) + "\r");

    setVar(
      testsCMakeLists,
      "ADD_CATCH2",
      "add_subdirectory(\n    ${PROJECT_SOURCE_DIR}/submodules/Catch2\n    ${PROJECT_BINARY_DIR}/submodules/Catch2\n)\ninclude(${PROJECT_SOURCE_DIR}/submodules/Catch2/extras/Catch.cmake)",
    );
  }
}

function addDependencyGoogleTest() {
  if (config.dependencyType === "cpm") {
    appendToCpmPackageLock(
      "CPMDeclarePackage(googletest\n    GITHUB_REPOSITORY google/googletest\n    GIT_TAG v1.18.0\n    SYSTEM YES\n    EXCLUDE_FROM_ALL YES\n)",
    );
    setVar(
      testsCMakeLists,
      "ADD_GOOGLETEST",
      "CPMGetPackage(googletest)\ninclude(GoogleTest)",
    );
  } else if (config.dependencyType === "fetchContent") {
    setVar(
      testsCMakeLists,
      "ADD_GOOGLETEST",
      'message(STATUS "Fetching GoogleTest...")\nFetchContent_Declare(googletest\n    GIT_REPOSITORY https://github.com/google/googletest.git\n    GIT_TAG v1.18.0\n    GIT_SHALLOW TRUE\n)\nFetchContent_MakeAvailable(googletest)\ninclude(GoogleTest)',
    );
  } else if (config.dependencyType === "submodule") {
    const message = "Cloning GoogleTest…";
    process.stdout.write(message);
    child_process.execSync(
      "git submodule add https://github.com/google/googletest.git ./submodules/googletest",
      { cwd: projectDir },
    );
    process.stdout.write("\r" + " ".repeat(message.length) + "\r");

    setVar(
      testsCMakeLists,
      "ADD_GOOGLETEST",
      "add_subdirectory(\n    ${PROJECT_SOURCE_DIR}/submodules/googletest\n    ${PROJECT_BINARY_DIR}/submodules/googletest\n)\ninclude(GoogleTest)",
    );
  }
}

function addDependencyDoctest() {
  if (config.dependencyType === "cpm") {
    appendToCpmPackageLock(
      "CPMDeclarePackage(doctest\n    GITHUB_REPOSITORY doctest/doctest\n    GIT_TAG v2.5.3\n    SYSTEM YES\n    EXCLUDE_FROM_ALL YES\n)",
    );
    setVar(
      testsCMakeLists,
      "ADD_DOCTEST",
      "CPMGetPackage(doctest)\ninclude(${doctest_SOURCE_DIR}/scripts/cmake/doctest.cmake)",
    );
  } else if (config.dependencyType === "fetchContent") {
    setVar(
      testsCMakeLists,
      "ADD_DOCTEST",
      'message(STATUS "Fetching doctest...")\nFetchContent_Declare(doctest\n    GIT_REPOSITORY https://github.com/doctest/doctest.git\n    GIT_TAG v2.5.3\n    GIT_SHALLOW TRUE\n)\nFetchContent_MakeAvailable(doctest)\ninclude(${doctest_SOURCE_DIR}/scripts/cmake/doctest.cmake)',
    );
  } else if (config.dependencyType === "submodule") {
    const message = "Cloning doctest…";
    process.stdout.write(message);
    child_process.execSync(
      "git submodule add https://github.com/doctest/doctest.git ./submodules/doctest",
      { cwd: projectDir },
    );
    process.stdout.write("\r" + " ".repeat(message.length) + "\r");

    setVar(
      testsCMakeLists,
      "ADD_DOCTEST",
      "add_subdirectory(\n    ${PROJECT_SOURCE_DIR}/submodules/doctest\n    ${PROJECT_BINARY_DIR}/submodules/doctest\n)\ninclude(${PROJECT_SOURCE_DIR}/submodules/doctest/scripts/cmake/doctest.cmake)",
    );
  }
}

function addDependencyTinyBdd() {
  if (config.dependencyType === "cpm") {
    appendToCpmPackageLock(
      'CPMDeclarePackage(tiny-bdd\n    GITHUB_REPOSITORY ImJimmi/tiny-bdd\n    GIT_TAG main\n    SYSTEM YES\n    EXCLUDE_FROM_ALL YES\n    OPTIONS\n        "TBDD_GENERATE_TEST_RUNNER OFF"\n)',
    );
    setVar(
      testsCMakeLists,
      "ADD_TINY_BDD",
      // tiny-bdd's own CMakeLists.txt uses CMAKE_SOURCE_DIR instead of
      // CMAKE_CURRENT_SOURCE_DIR for its include path, so it needs fixing up
      // when consumed as a dependency rather than as the top-level project.
      "CPMGetPackage(tiny-bdd)\ntarget_include_directories(tiny-bdd INTERFACE ${tiny-bdd_SOURCE_DIR})",
    );
  } else if (config.dependencyType === "fetchContent") {
    setVar(
      testsCMakeLists,
      "ADD_TINY_BDD",
      'message(STATUS "Fetching tiny-bdd...")\nset(TBDD_GENERATE_TEST_RUNNER OFF CACHE BOOL "" FORCE)\nFetchContent_Declare(tiny-bdd\n    GIT_REPOSITORY https://github.com/ImJimmi/tiny-bdd.git\n    GIT_TAG main\n    GIT_SHALLOW TRUE\n)\nFetchContent_MakeAvailable(tiny-bdd)\ntarget_include_directories(tiny-bdd INTERFACE ${tiny-bdd_SOURCE_DIR})',
    );
  } else if (config.dependencyType === "submodule") {
    const message = "Cloning tiny-bdd…";
    process.stdout.write(message);
    child_process.execSync(
      "git submodule add https://github.com/ImJimmi/tiny-bdd.git ./submodules/tiny-bdd",
      { cwd: projectDir },
    );
    process.stdout.write("\r" + " ".repeat(message.length) + "\r");

    setVar(
      testsCMakeLists,
      "ADD_TINY_BDD",
      'set(TBDD_GENERATE_TEST_RUNNER OFF CACHE BOOL "" FORCE)\nadd_subdirectory(\n    ${PROJECT_SOURCE_DIR}/submodules/tiny-bdd\n    ${PROJECT_BINARY_DIR}/submodules/tiny-bdd\n)\ntarget_include_directories(tiny-bdd INTERFACE ${PROJECT_SOURCE_DIR}/submodules/tiny-bdd)',
    );
  }
}

async function addUnitTestFramework() {
  await promptUser({
    type: "select",
    name: "unitTestFramework",
    message: "Which unit-testing framework do you want to use?",
    choices: [
      { title: "Catch2", value: "catch2" },
      { title: "GoogleTest", value: "googletest" },
      { title: "doctest", value: "doctest" },
      { title: "JUCE's built-in API", value: "juce" },
      { title: "Tiny-BDD", value: "tiny-bdd" },
    ],
  });

  fs.mkdirSync(path.join(projectDir, "tests"));
  testsCMakeLists = path.join(projectDir, "tests", "CMakeLists.txt");

  if (config.unitTestFramework === "catch2") {
    fs.copyFileSync(
      path.join(templatesDir, "Catch2-CMakeLists.txt"),
      testsCMakeLists,
    );

    addDependencyCatch2();

    fs.copyFileSync(
      path.join(templatesDir, "Catch2-Tests.cpp"),
      path.join(projectDir, "tests", "Tests.cpp"),
    );
  } else if (config.unitTestFramework === "googletest") {
    fs.copyFileSync(
      path.join(templatesDir, "GoogleTest-CMakeLists.txt"),
      testsCMakeLists,
    );

    addDependencyGoogleTest();

    fs.copyFileSync(
      path.join(templatesDir, "GoogleTest-Tests.cpp"),
      path.join(projectDir, "tests", "Tests.cpp"),
    );
  } else if (config.unitTestFramework === "doctest") {
    fs.copyFileSync(
      path.join(templatesDir, "Doctest-CMakeLists.txt"),
      testsCMakeLists,
    );

    addDependencyDoctest();

    fs.copyFileSync(
      path.join(templatesDir, "Doctest-Tests.cpp"),
      path.join(projectDir, "tests", "Tests.cpp"),
    );
  } else if (config.unitTestFramework === "tiny-bdd") {
    fs.copyFileSync(
      path.join(templatesDir, "Tiny-BDD-CMakeLists.txt"),
      testsCMakeLists,
    );

    addDependencyTinyBdd();

    fs.copyFileSync(
      path.join(templatesDir, "Tiny-BDD-main.cpp"),
      path.join(projectDir, "tests", "main.cpp"),
    );
  } else if (config.unitTestFramework === "juce") {
    fs.copyFileSync(
      path.join(templatesDir, "JUCE-Tests-CMakeLists.txt"),
      testsCMakeLists,
    );
    fs.copyFileSync(
      path.join(templatesDir, "JUCE-Tests-main.cpp"),
      path.join(projectDir, "tests", "main.cpp"),
    );
    fs.copyFileSync(
      path.join(templatesDir, "JUCE-Tests.h"),
      path.join(projectDir, "tests", "Tests.h"),
    );
    fs.copyFileSync(
      path.join(templatesDir, "JUCE-Tests.cpp"),
      path.join(projectDir, "tests", "Tests.cpp"),
    );
    fs.copyFileSync(
      path.join(templatesDir, "JUCE-Tests-discovery.cmake"),
      path.join(projectDir, "cmake", "DiscoverTests.cmake"),
    );
  }

  setVar(testsCMakeLists, "PROJECT_ID", config.projectID);

  return 0;
}

function addREADME() {
  const README = path.join(projectDir, "README.md");
  fs.copyFileSync(path.join(templatesDir, "README.md"), README);

  setVar(README, "PROJECT_NAME", config.projectName);

  let additionalBadges = [];

  if (config.dependencyType === "cpm") {
    const home = os.homedir();
    setVar(
      README,
      "CPM_SOURCE_CACHE_ROW",
      `| \`CPM_SOURCE_CACHE\` | Where [CPM](https://github.com/cpm-cmake/cpm.cmake) should cache dependencies | ${home}/.cache/CPM |`,
    );
  }

  if (config.webLanguage === "javascript") {
    additionalBadges.push(
      '<img src="https://img.shields.io/badge/javascript-F7DF1E?logo=javascript&style=for-the-badge&logoColor=black"/>',
    );
  } else if (config.webLanguage === "typescript") {
    additionalBadges.push(
      '<img src="https://img.shields.io/badge/typescript-3178C6?logo=typescript&style=for-the-badge&logoColor=white"/>',
    );
  }

  if (config.guiAPI === "webview") {
    additionalBadges.push(
      '<img src="https://img.shields.io/badge/vite-9135FF?style=for-the-badge&logo=vite&logoColor=white"/>',
    );

    if (config.webFramework === "svelte") {
      additionalBadges.push(
        '<img src="https://img.shields.io/badge/svelte-FF3E00?logo=svelte&style=for-the-badge&logoColor=white"/>',
      );
    } else if (config.webFramework === "react") {
      additionalBadges.push(
        '<img src="https://img.shields.io/badge/react-61DAFB?logo=react&style=for-the-badge&logoColor=black"/>',
      );
    } else if (config.webFramework === "vue") {
      additionalBadges.push(
        '<img src="https://img.shields.io/badge/vuedotjs-4FC08D?logo=vuedotjs&style=for-the-badge&logoColor=white"/>',
      );
    } else if (config.webFramework === "preact") {
      additionalBadges.push(
        '<img src="https://img.shields.io/badge/preact-673AB8?logo=preact&style=for-the-badge"/>',
      );
    } else if (config.webFramework === "lit") {
      additionalBadges.push(
        '<img src="https://img.shields.io/badge/lit-324FFF?logo=lit&style=for-the-badge"/>',
      );
    } else if (config.webFramework === "solid") {
      additionalBadges.push(
        '<img src="https://img.shields.io/badge/solid-2C4F7C?logo=solid&style=for-the-badge"/>',
      );
    } else if (config.webFramework === "qwik") {
      additionalBadges.push(
        '<img src="https://img.shields.io/badge/qwik-AC7EF4?logo=qwik&style=for-the-badge&logoColor=white"/>',
      );
    }
  }

  if (additionalBadges.length > 0) {
    setVar(README, "ADDITIONAL_BADGES", additionalBadges.join("\n  "));
  }

  clearUnsetVars(README);

  return 0;
}

function makeInitialCommit() {
  try {
    child_process.execSync("git add --all", { cwd: projectDir });
    child_process.execSync(
      'git commit -m "Create initial project using create-juce-app"',
      { cwd: projectDir },
    );
  } catch (err) {
    console.error(err.stdout.toString());
  }
}

function runCMake() {
  child_process.execSync(
    `cmake -B build -G "Ninja Multi-Config" -DCPM_SOURCE_CACHE=${os.homedir()}/.cache/CPM`,
    {
      cwd: projectDir,
      encoding: "utf-8",
      stdio: "inherit",
    },
  );
  child_process.execSync(`cmake --build build`, {
    cwd: projectDir,
    encoding: "utf-8",
    stdio: "inherit",
  });
  child_process.execSync(
    `ctest . -C Debug --extra-verbose --debug --output-on-failure`,
    {
      cwd: path.join(projectDir, "build"),
      encoding: "utf-8",
      stdio: "inherit",
    },
  );
  child_process.execSync(`cpack . -C Debug --verbose`, {
    cwd: path.join(projectDir, "build"),
    encoding: "utf-8",
    stdio: "inherit",
  });
}

try {
  let result = await makeInitialProjectDir();
  if (result === 0) result = await makeInitialCMakeProject();
  if (result === 0) result = await addUnitTestFramework();
  if (result === 0) result = addREADME();

  if (result !== 0) {
    console.error(`Ended with code ${result}`);
    process.exit(result);
  }

  clearUnsetVars(projectCMakeLists);
  clearUnsetVars(testsCMakeLists);
  makeInitialCommit();

  if (dumpFile) {
    dumpConfig();
  }

  if (process.argv.includes("--debug")) {
    runCMake();
  }
} catch (err) {
  console.error(err);
  process.exit(1);
}
