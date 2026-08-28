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

const githubTokenArg = "--github-token=";
const githubToken =
  process.argv
    .find((arg) => arg.startsWith(githubTokenArg))
    ?.slice(githubTokenArg.length) ??
  process.env.GITHUB_TOKEN ??
  process.env.GH_TOKEN;

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
  config = {
    ...config,
    ...(await prompts([promptObject])),
  };
}

function toKebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
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

  const releases = (
    await fetchGitHubJson(
      "https://api.github.com/repos/juce-framework/JUCE/releases",
    )
  ).map((release) => ({ title: release.name, value: release.tag_name }));

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
    choices: await collectJuceVersions(),
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
      `include(FetchContent)\n\nmessage(STATUS "Fetching JUCE (this may take a few minutes)...")\nFetchContent_Declare(JUCE\n    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git\n    GIT_TAG ${config.juceVersion}\n    GIT_SHALLOW TRUE\n)\nFetchContent_MakeAvailable(JUCE)`,
    );
  } else if (config.dependencyType === "submodule") {
    fs.mkdirSync(path.join(projectDir, "submodules"));

    const message = "Cloning JUCE (this may take a few minutes)…";
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

async function makeInitialCMakeProject() {
  projectCMakeLists = path.join(projectDir, "CMakeLists.txt");
  fs.copyFileSync(path.join(templatesDir, "CMakeLists.txt"), projectCMakeLists);
  setVar(projectCMakeLists, "PROJECT_ID", config.projectID);
  setVar(projectCMakeLists, "PROJECT_NAME", config.projectName);
  setVar(projectCMakeLists, "COMPANY_NAME", config.companyName);
  setVar(
    projectCMakeLists,
    "BUNDLE_ID",
    `BUNDLE_ID "com.${toKebabCase(config.companyName)}.${config.projectID}"`,
  );

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

  const assetsDir = path.join(projectDir, "assets");
  fs.mkdirSync(assetsDir);
  fs.cpSync(
    path.join(templatesDir, "macOS_icon.icon"),
    path.join(assetsDir, "AppIcon.icon"),
    { recursive: true },
  );
  fs.copyFileSync(
    path.join(templatesDir, "Icon_512x.jpg"),
    path.join(assetsDir, "Icon_512x.jpg"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "Icon_256x.jpg"),
    path.join(assetsDir, "Icon_256x.jpg"),
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
        { title: "Typescript", value: "-ts" },
        { title: "JavaScript", value: "" },
      ],
    });

    child_process.execSync(
      `npm create vite@latest frontend -- --template ${config.webFramework}${config.webLanguage} --no-immediate --no-interactive`,
      { cwd: projectDir, stdio: ["inherit", "ignore", "inherit"] },
    );
  }

  if (config.projectType === "plugin") {
    setVar(projectCMakeLists, "JUCE_ADD_TARGET_FUNCTION", "juce_add_plugin");
    setVar(
      projectCMakeLists,
      "PLUGIN_FORMATS",
      `FORMATS ${config.pluginFormats.join(" ")}`,
    );
    setVar(
      projectCMakeLists,
      "ICONS",
      'ICON_BIG "${PROJECT_SOURCE_DIR}/assets/Icon_512x.jpg"\n    ICON_SMALL "${PROJECT_SOURCE_DIR}/assets/Icon_256x.jpg"',
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

    fs.mkdirSync(path.join(projectSourceDir, "audio"));
    if (config.dspAPI === "basic") {
      fs.copyFileSync(
        path.join(templatesDir, "plugin-main-audio-processor-basic.h"),
        path.join(projectSourceDir, "audio", "MainAudioProcessor.h"),
      );
      setVar(
        path.join(projectSourceDir, "Processor.h"),
        "PREPARE_TO_PLAY_IMPL",
        "mainAudioProcessor = std::make_unique<MainAudioProcessor>(sampleRate,\n                                                                  blockSize,\n                                                                  getMainBusNumOutputChannels(),\n                                                                  apvts);",
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
        "const juce::dsp::ProcessSpec spec{\n            sampleRate,\n            static_cast<juce::uint32>(blockSize),\n            static_cast<juce::uint32>(getMainBusNumOutputChannels()),\n        };\n        mainAudioProcessor = std::make_unique<MainAudioProcessor>(spec, apvts);",
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
    fs.copyFileSync(
      path.join(templatesDir, "plugin-editor.h"),
      path.join(projectSourceDir, "editor", "Editor.h"),
    );
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
  } else if (config.projectType === "desktop") {
    setVar(projectCMakeLists, "JUCE_ADD_TARGET_FUNCTION", "juce_add_gui_app");
    setVar(
      projectCMakeLists,
      "ICONS",
      'ICON_BIG "${PROJECT_SOURCE_DIR}/assets/Icon_512x.jpg"\n    ICON_SMALL "${PROJECT_SOURCE_DIR}/assets/Icon_256x.jpg"\n    ICON_COMPOSER_BUNDLE "${PROJECT_SOURCE_DIR}/assets/AppIcon.icon"',
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

async function addUnitTestFramework() {
  await promptUser({
    type: "select",
    name: "unitTestFramework",
    message: "Which unit-testing framework do you want to use?",
    choices: [
      { title: "Catch2", value: "catch2" },
      { title: "GoogleTest", value: "googletest" },
      { title: "JUCE's built-in API", value: "juce" },
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
}

try {
  let result = await makeInitialProjectDir();
  if (result === 0) result = await makeInitialCMakeProject();
  if (result === 0) result = await addUnitTestFramework();

  if (result !== 0) {
    console.error(`Ended with code ${result}`);
    process.exit(result);
  }

  clearUnsetVars(projectCMakeLists);
  clearUnsetVars(testsCMakeLists);
  makeInitialCommit();

  if (process.argv.includes("--debug")) {
    runCMake();
  }
} catch (err) {
  console.error(err);
}
