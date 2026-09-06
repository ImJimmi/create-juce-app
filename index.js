#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import child_process from "node:child_process";
import os from "node:os";
import prompts from "prompts";

import {
  addJUCE,
  collectJuceVersions,
  fetchLatestCPM,
} from "./source/dependencies.js";
import { populateDesktopSpecificCMakeTemplates } from "./source/desktop.js";
import { makeInitialCommit } from "./source/GitHub.js";
import { populatePluginSpecificCMakeTemplates } from "./source/plugins.js";
import { addNonTemplatedProjectFiles, addREADME } from "./source/projects.js";
import { addUnitTestFramework } from "./source/unit-tests.js";
import {
  clearUnsetVars,
  getArgValue,
  setVar,
  templatesDir,
  toKebabCase,
  toTitleCase,
} from "./source/utils.js";

let config = {};

const dotEnvFile = path.join(process.cwd(), ".env");
if (fs.existsSync(dotEnvFile)) {
  process.loadEnvFile(dotEnvFile);
}

const configFile = getArgValue("--config=");
const dumpFile = getArgValue("--dump=");
const debug = process.argv.includes("--debug");

if (configFile) {
  config = JSON.parse(
    fs.readFileSync(path.resolve(configFile), { encoding: "utf-8" }),
  );
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

async function makeInitialProjectDir() {
  config.projectDir = path.join(process.cwd(), config.projectID);
  config.relativeSourceDir = path.join("source", config.projectID);
  config.projectSourceDir = path.join(
    config.projectDir,
    config.relativeSourceDir,
  );
  config.projectCmakeDir = path.join(config.projectDir, "cmake");
  config.projectCMakeLists = path.join(config.projectDir, "CMakeLists.txt");
  config.projectAssetsDir = path.join(config.projectDir, "assets");
  config.projectInstallersDir = path.join(config.projectDir, "installers");
  config.projectGhaWorkflowsDir = path.join(
    config.projectDir,
    ".github",
    "workflows",
  );
  config.projectGhaActionsDir = path.join(
    config.projectDir,
    ".github",
    "actions",
  );

  if (!fs.existsSync(config.projectDir)) {
    fs.mkdirSync(config.projectDir);
  } else if (fs.readdirSync(config.projectDir).length > 0) {
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
      fs.rmSync(config.projectDir, { recursive: true, force: true });
      fs.mkdirSync(config.projectDir);
    } else {
      throw new Error(
        `${config.projectID}/ already exists. Choose a different project folder`,
      );
    }
  }

  child_process.execSync("git init && git branch -m main", {
    cwd: config.projectDir,
    encoding: "utf-8",
    stdio: "ignore",
  });

  addNonTemplatedProjectFiles(config);
}

async function promptForDependencyType() {
  await promptUser({
    type: "select",
    name: "dependencyType",
    message: "Dependency manager:",
    choices: [
      { title: "CPM (recommended)", value: "cpm" },
      { title: "FetchContent", value: "fetchContent" },
      { title: "git submodules", value: "submodule" },
    ],
  });

  if (config.dependencyType === "cpm") {
    await fetchLatestCPM(config);

    setVar(
      config.projectCMakeLists,
      "INIT_PACKAGE_MANAGER",
      'if(NOT CPM_SOURCE_CACHE)\n    set(CPM_SOURCE_CACHE "$ENV{HOME}/.cache/CPM")\nendif()\n\ninclude(CPM)\nCPMUsePackageLock(cpm-package-lock.cmake)',
    );
  } else if (config.dependencyType === "fetchContent") {
    setVar(
      config.projectCMakeLists,
      "INIT_PACKAGE_MANAGER",
      "include(FetchContent)",
    );
  }
}

function initialiseWebFrontend() {
  setVar(
    config.projectCMakeLists,
    "NEEDS_WEB_BROWSER",
    "NEEDS_WEB_BROWSER TRUE\n    NEEDS_WEBVIEW2 TRUE",
  );

  child_process.execSync(
    `npm create vite@latest frontend -- --template ${config.webFramework}${config.webLanguage === "typescript" ? "-ts" : ""} --no-immediate --no-interactive`,
    { cwd: config.projectDir, stdio: "ignore" },
  );
  child_process.execSync("npm install --package-lock-only", {
    cwd: path.join(config.projectDir, "frontend"),
    stdio: "ignore",
  });
}

async function populateCMakeTemplates() {
  config.bundleID = `com.${toKebabCase(config.companyName)}.${config.projectID}`;

  setVar(config.projectCMakeLists, "PROJECT_ID", config.projectID);
  setVar(config.projectCMakeLists, "PROJECT_NAME", config.projectName);
  setVar(config.projectCMakeLists, "COMPANY_NAME", config.companyName);
  setVar(
    config.projectCMakeLists,
    "BUNDLE_ID",
    `BUNDLE_ID "${config.bundleID}"`,
  );

  if (config.guiAPI === "webview") initialiseWebFrontend();

  if (config.projectType === "plugin") {
    await populatePluginSpecificCMakeTemplates(config);
  } else if (config.projectType === "desktop") {
    await populateDesktopSpecificCMakeTemplates(config);
  } else if (config.projectType === "console") {
    setVar(
      config.projectCMakeLists,
      "JUCE_ADD_TARGET_FUNCTION",
      "juce_add_console_app",
    );

    fs.copyFileSync(
      path.join(templatesDir, "console-main.cpp"),
      path.join(config.projectSourceDir, "main.cpp"),
    );
    setVar(
      config.projectCMakeLists,
      "SOURCES",
      path.join("${PROJECT_SOURCE_DIR}", config.relativeSourceDir, "main.cpp"),
    );

    setVar(config.projectCMakeLists, "LINK_LIBRARIES", "juce::juce_core");
  }
}

function runCMake() {
  child_process.execSync(
    `cmake -B build -G "Ninja Multi-Config" -DCPM_SOURCE_CACHE=${os.homedir()}/.cache/CPM`,
    {
      cwd: config.projectDir,
      encoding: "utf-8",
      stdio: "inherit",
    },
  );
  child_process.execSync(`cmake --build build`, {
    cwd: config.projectDir,
    encoding: "utf-8",
    stdio: "inherit",
  });
  child_process.execSync(
    `ctest . -C Debug --extra-verbose --debug --output-on-failure`,
    {
      cwd: path.join(config.projectDir, "build"),
      encoding: "utf-8",
      stdio: "inherit",
    },
  );
  child_process.execSync(`cpack . -C Debug --verbose`, {
    cwd: path.join(config.projectDir, "build"),
    encoding: "utf-8",
    stdio: "inherit",
  });
}

async function main() {
  await promptUser({
    type: "text",
    name: "projectName",
    message: "Project name:",
    initial: "My JUCE Project",
  });
  await promptUser({
    type: "text",
    name: "projectID",
    message: "Project folder:",
    initial: toKebabCase(config.projectName),
  });
  await makeInitialProjectDir();
  await promptUser({
    type: "text",
    name: "companyName",
    message: "Company name:",
    initial: "My Company",
  });

  await promptUser({
    type: "select",
    name: "projectType",
    message: "Project type:",
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
      message: "Plugin code:",
      validate: (code) => {
        if (code.length === 4 && code[0].toUpperCase() === code[0]) return true;

        return "Plugin Code must be 4 letters and start with an upper-case letter";
      },
      initial: `${toTitleCase(config.projectName.replace(/\W/g, "").substring(0, 4))}`,
    });
    await promptUser({
      type: "text",
      name: "pluginManufacturerCode",
      message: "Manufacturer code:",
      validate: (code) => {
        if (code.length === 4 && code[0].toUpperCase() === code[0]) return true;

        return "Manufacturer Code must be 4 letters and start with an upper-case letter";
      },
      initial: `${toTitleCase(config.companyName.replace(/\W/g, "").substring(0, 4))}`,
    });
    await promptUser({
      type: "multiselect",
      name: "pluginFormats",
      message: "Formats:",
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
        message: "VST2 SDK path:",
      });
    }

    await promptUser({
      type: "select",
      name: "pluginType",
      message: "Plugin type:",
      choices: [
        { title: "Effect", value: "fx" },
        { title: "Instrument", value: "synth" },
        { title: "MIDI Effect", value: "midi" },
      ],
    });

    if (config.pluginType !== "midi") {
      await promptUser({
        type: "multiselect",
        name: "midiIO",
        message: "MIDI usage:",
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
        message: "Plugin category:",
        choices: [
          { title: "Analyzer", value: "analyzer" },
          { title: "Delay", value: "delay" },
          { title: "Distortion", value: "distortion" },
          { title: "Dynamics", value: "dynamics" },
          { title: "EQ", value: "eq" },
          { title: "Filter", value: "filter" },
          { title: "Generator", value: "generator" },
          { title: "Mastering", value: "mastering" },
          { title: "Modulation", value: "modulation" },
          { title: "Pitch Shift", value: "pitchShift" },
          { title: "Restoration", value: "restoration" },
          { title: "Reverb", value: "reverb" },
          { title: "Spatial", value: "spatial" },
          { title: "Tool", value: "tools" },
          { title: "Other", value: "none" },
        ],
      });
    } else {
      config.pluginEffectCategory = "none";
    }
  }

  if (config.projectType !== "console") {
    await promptUser({
      type: "select",
      name: "guiAPI",
      message: "GUI API:",
      choices: [
        { title: "Traditional JUCE Components", value: "component" },
        { title: "Web front-end", value: "webview" },
      ],
    });

    if (config.guiAPI === "webview") {
      await promptUser({
        type: "select",
        name: "webFramework",
        message: "Web UI framework:",
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
        message: "Web UI language:",
        choices: [
          { title: "Typescript", value: "typescript" },
          { title: "JavaScript", value: "javascript" },
        ],
      });
    }

    if (config.projectType === "plugin") {
      if (config.pluginType === "midi") {
        config.dspAPI = "basic";
      } else {
        await promptUser({
          type: "select",
          name: "dspAPI",
          message: "DSP API:",
          choices: [
            { title: "Basic JUCE audio API", value: "basic" },
            { title: "juce_dsp module", value: "juce_dsp" },
          ],
        });
      }
    }
  }

  await promptForDependencyType();
  await populateCMakeTemplates();

  await promptUser({
    type: "select",
    name: "juceVersion",
    message: "JUCE version:",
    choices: collectJuceVersions,
  });
  await addJUCE(config);

  await promptUser({
    type: "select",
    name: "unitTestFramework",
    message: "Unit-test framework:",
    choices: [
      { title: "Catch2", value: "catch2" },
      { title: "GoogleTest", value: "googletest" },
      { title: "doctest", value: "doctest" },
      { title: "JUCE's built-in API", value: "juce" },
      { title: "Tiny-BDD", value: "tiny-bdd" },
      { title: "No unit tests", value: "none" },
    ],
  });
  await addUnitTestFramework(config);

  addREADME(config);
  clearUnsetVars(config.projectCMakeLists);
  makeInitialCommit(config);

  if (dumpFile) dumpConfig();
  if (debug) runCMake();
}

try {
  await main();
} catch (error) {
  if (debug) console.error(error);
  else console.error(error.message);

  if (error.cause) console.error(error.cause.message);

  process.exit(1);
}
