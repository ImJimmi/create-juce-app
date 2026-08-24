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

async function makeInitialProjectDir() {
  await promptUser({
    type: "text",
    name: "projectName",
    message: "What is the name of your project?",
    initial: "My JUCE Project",
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
  }

  return 0;
}

async function addJuceDependency() {
  let juceDependencyChoices = [
    { title: "Using CPM (recommended)", value: "cpm" },
    { title: "Using FetchContent", value: "fetchContent" },
  ];

  if (config.initGit) {
    juceDependencyChoices.push({
      title: "As a git submodule",
      value: "submodule",
    });
  }

  await promptUser({
    type: "select",
    name: "juceDependencyType",
    message: "How do you want to add JUCE?",
    choices: juceDependencyChoices,
  });

  if (config.juceDependencyType === "cpm") {
    const message = "Fetching latest CPM.cmake…";
    process.stdout.write(message);

    const latestRelease = await fetch(
      "https://api.github.com/repos/cpm-cmake/cpm.cmake/releases/latest",
    );
    const assets = await (
      await fetch((await latestRelease.json()).assets_url)
    ).json();
    const getCPMAsset = assets.find((asset) => asset.name === "get_cpm.cmake");
    const response = await fetch(getCPMAsset.browser_download_url);
    const getCPMFile = path.join(os.tmpdir(), "get_cpm.cmake");
    fs.writeFileSync(getCPMFile, await response.text(), {
      encoding: "utf-8",
    });
    child_process.execSync(
      `cmake -DCPM_PATH="${path.join(projectDir, "cmake")}" -P ${getCPMFile}`,
      {
        cwd: projectDir,
      },
    );

    process.stdout.write("\r" + " ".repeat(message.length) + "\r");

    setVar(
      projectCMakeLists,
      "ADD_JUCE_DEPENDENCY",
      'include(cmake/CPM.cmake)\nCPMAddPackage("gh:juce-framework/JUCE#master")',
    );
  } else if (config.juceDependencyType === "fetchContent") {
    setVar(
      projectCMakeLists,
      "ADD_JUCE_DEPENDENCY",
      "include(FetchContent)\nFetchContent_Declare(JUCE\n    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git\n    GIT_TAG master\n    GIT_SHALLOW TRUE\n)\nFetchContent_MakeAvailable(JUCE)",
    );
  } else if (config.juceDependencyType === "submodule") {
    fs.mkdirSync(path.join(projectDir, "submodules"));

    const message = "Cloning JUCE (this may take a few minutes)…";
    process.stdout.write(message);
    child_process.execSync(
      "git submodule add https://github.com/juce-framework/JUCE.git ./submodules/JUCE",
      { cwd: projectDir },
    );
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
      hint: "- Space to select. Return to submit",
      min: 1,
      choices: [
        { title: "AAX", value: "AAX", selected: true },
        { title: "AU", value: "AU", selected: true },
        { title: "Standalone", value: "Standalone", selected: true },
        { title: "VST3", value: "VST3", selected: true },
        { title: "AUv3", value: "AUv3" },
        { title: "LV2", value: "LV2" },
        { title: "Unity", value: "Unity" },
        { title: "VST", value: "VST" },
      ],
    });
  }

  await addJuceDependency();

  if (config.projectType === "plugin") {
    setVar(projectCMakeLists, "JUCE_ADD_TARGET_FUNCTION", "juce_add_plugin");
    setVar(
      projectCMakeLists,
      "PLUGIN_FORMATS",
      `FORMATS ${config.pluginFormats.join(" ")}`,
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

    setVar(projectCMakeLists, "LINK_LIBRARIES", "juce::juce_gui_basics");
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

  clearUnsetVars(projectCMakeLists);

  return 0;
}

function runCMake() {
  child_process.execSync(
    `cmake -B build -G Ninja -DCPM_SOURCE_CACHE=${os.homedir()}/.cache/CPM`,
    {
      cwd: projectDir,
      encoding: "utf-8",
      stdio: "inherit",
    },
  );
}

async function main() {
  try {
    let result = await makeInitialProjectDir();
    if (result === 0) result = await makeInitialCMakeProject();

    if (result === 0) runCMake();
  } catch (err) {
    console.error(err);
  }
}

if (import.meta.url.endsWith(process.argv[1])) {
  await main();
}
