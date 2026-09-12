import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { fetchGitHubJson, fetchLatestGitHubTag } from "./GitHub.js";
import { setVar, templatesDir } from "./utils.js";

export async function fetchLatestCPM(config) {
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
    `cmake -DCPM_PATH="${path.join(config.projectDir, "cmake")}" -DCPM_SOURCE_CACHE=${os.homedir()}/.cache/CPM -P ${getCPMFile}`,
    {
      cwd: config.projectDir,
    },
  );

  process.stdout.write("\r" + " ".repeat(message.length) + "\r");
}

function appendToCpmPackageLock(config, entry) {
  const file = path.join(config.projectDir, "cpm-package-lock.cmake");
  fs.writeFileSync(
    file,
    `${fs.readFileSync(file, { encoding: "utf-8" })}${entry}\n`,
    {
      encoding: "utf-8",
    },
  );
}

async function addDependency(
  config,
  name,
  owner,
  gitTag,
  placeholderVar,
  targetFile = config.projectCMakeLists,
  preInclude = "",
  postInclude = "",
  downloadOnly = false,
) {
  if (preInclude !== "") preInclude = `${preInclude}\n`;
  if (postInclude !== "") postInclude = `\n${postInclude}`;

  if (config.dependencyType === "cpm") {
    appendToCpmPackageLock(
      config,
      `CPMDeclarePackage(${name}\n    GITHUB_REPOSITORY ${owner}/${name}\n    GIT_TAG ${gitTag}\n    SYSTEM YES\n    EXCLUDE_FROM_ALL YES\n${downloadOnly ? "    DOWNLOAD_ONLY YES\n" : ""})`,
    );
    setVar(
      targetFile,
      placeholderVar,
      `${preInclude}CPMGetPackage(${name})${postInclude}`,
    );
  } else if (config.dependencyType === "fetchContent") {
    setVar(
      targetFile,
      placeholderVar,
      `FetchContent_Declare(${name}\n    GIT_REPOSITORY https://github.com/${owner}/${name}.git\n    GIT_TAG ${gitTag}\n    GIT_SHALLOW TRUE\n)\n${preInclude}FetchContent_${downloadOnly ? "Populate" : "MakeAvailable"}(${name})${postInclude}`,
    );
  } else if (config.dependencyType === "submodule") {
    config.submodulesDir = path.join(config.projectDir, "submodules");

    if (!fs.existsSync(config.submodulesDir))
      fs.mkdirSync(config.submodulesDir);

    const message = `Cloning ${name}…`;
    process.stdout.write(message);
    child_process.execSync(
      `git submodule add https://github.com/${owner}/${name}.git ./submodules/${name}`,
      { cwd: config.projectDir, stdio: "pipe" },
    );
    child_process.execSync(`git checkout ${gitTag}`, {
      cwd: path.join(config.projectDir, "submodules", name),
      stdio: "pipe",
    });
    process.stdout.write("\r" + " ".repeat(message.length) + "\r");

    const addSubdirectory = downloadOnly
      ? ""
      : `add_subdirectory(\${${name}_SOURCE_DIR})\n`;
    setVar(
      targetFile,
      placeholderVar,
      `set(${name}_SOURCE_DIR \${PROJECT_SOURCE_DIR}/submodules/${name})\n${preInclude}${addSubdirectory}${postInclude}`,
    );
  }
}

export async function collectJuceVersions() {
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

export async function addJUCE(config) {
  return addDependency(
    config,
    "JUCE",
    "juce-framework",
    config.juceVersion,
    "ADD_JUCE",
  );
}

export async function addPluginval(config) {
  if (!config.pluginFormats.includes("VST3")) {
    return;
  }

  const gitTag = await fetchLatestGitHubTag("Tracktion/pluginval", "Pluginval");
  await addDependency(
    config,
    "pluginval",
    "Tracktion",
    gitTag,
    "ADD_PLUGINVAL",
    config.projectCMakeLists,
    "",
    "include(${pluginval_SOURCE_DIR}/tests/AddPluginvalTests.cmake)",
    true,
  );
  setVar(
    config.projectCMakeLists,
    "ADD_TESTS_PLUGINVAL",
    `add_pluginval_tests(${config.projectID})`,
  );
}

export async function addCatch2(config) {
  const gitTag = await fetchLatestGitHubTag("catchorg/Catch2", "Catch2");
  return addDependency(
    config,
    "Catch2",
    "catchorg",
    gitTag,
    "ADD_CATCH2",
    config.testsCMakeLists,
    "",
    "include(${Catch2_SOURCE_DIR}/extras/Catch.cmake)",
  );
}

export async function addGoogleTest(config) {
  const gitTag = await fetchLatestGitHubTag("google/googletest", "GoogleTest");
  return addDependency(
    config,
    "googletest",
    "google",
    gitTag,
    "ADD_GOOGLETEST",
    config.testsCMakeLists,
    "",
    'include("GoogleTest")',
  );
}

export async function addDoctest(config) {
  const gitTag = await fetchLatestGitHubTag("doctest/doctest", "doctest");
  return addDependency(
    config,
    "doctest",
    "doctest",
    gitTag,
    "ADD_DOCTEST",
    config.testsCMakeLists,
    "",
    "include(${doctest_SOURCE_DIR}/scripts/cmake/doctest.cmake)",
  );
}

export function addTinyBdd(config) {
  return addDependency(
    config,
    "tiny-bdd",
    "ImJimmi",
    "main",
    "ADD_TINY_BDD",
    config.testsCMakeLists,
    'set(TBDD_GENERATE_TEST_RUNNER OFF CACHE BOOL "" FORCE)',
  );
}

export async function addGamma(config) {
  fs.copyFileSync(
    path.join(templatesDir, "Gamma.cmake"),
    path.join(config.projectCmakeDir, "Gamma.cmake"),
  );
  await addDependency(
    config,
    "Gamma",
    "LancePutnam",
    "c883c71ac1f400e1dd3c1c8c966a7f945a17acd1",
    "ADD_GAMMA",
    path.join(config.projectCmakeDir, "Gamma.cmake"),
    "",
    "",
    true,
  );

  setVar(config.projectCMakeLists, "ADD_GAMMA", "include(Gamma)");
  setVar(config.projectCMakeLists, "LINK_GAMMA", "Gamma");
}
