import fs from "node:fs";
import path from "node:path";

import {
  addCatch2,
  addDoctest,
  addGoogleTest,
  addTinyBdd,
} from "./dependencies.js";
import { clearUnsetVars, setVar, templatesDir } from "./utils.js";

export async function addUnitTestFramework(config) {
  if (config.unitTestFramework === "none") {
    return;
  }

  fs.mkdirSync(path.join(config.projectDir, "tests"));
  setVar(
    config.projectCMakeLists,
    "ADD_TESTS",
    "include(CTest)\nadd_subdirectory(tests)",
  );

  config.testsCMakeLists = path.join(
    config.projectDir,
    "tests",
    "CMakeLists.txt",
  );

  if (config.unitTestFramework === "catch2") {
    fs.copyFileSync(
      path.join(templatesDir, "Catch2-CMakeLists.txt"),
      config.testsCMakeLists,
    );

    await addCatch2(config);

    fs.copyFileSync(
      path.join(templatesDir, "Catch2-Tests.cpp"),
      path.join(config.projectDir, "tests", "Tests.cpp"),
    );
  } else if (config.unitTestFramework === "googletest") {
    fs.copyFileSync(
      path.join(templatesDir, "GoogleTest-CMakeLists.txt"),
      config.testsCMakeLists,
    );

    await addGoogleTest(config);

    fs.copyFileSync(
      path.join(templatesDir, "GoogleTest-Tests.cpp"),
      path.join(config.projectDir, "tests", "Tests.cpp"),
    );
  } else if (config.unitTestFramework === "doctest") {
    fs.copyFileSync(
      path.join(templatesDir, "Doctest-CMakeLists.txt"),
      config.testsCMakeLists,
    );

    await addDoctest(config);

    fs.copyFileSync(
      path.join(templatesDir, "Doctest-Tests.cpp"),
      path.join(config.projectDir, "tests", "Tests.cpp"),
    );
  } else if (config.unitTestFramework === "tiny-bdd") {
    fs.copyFileSync(
      path.join(templatesDir, "Tiny-BDD-CMakeLists.txt"),
      config.testsCMakeLists,
    );

    addTinyBdd(config);

    fs.copyFileSync(
      path.join(templatesDir, "Tiny-BDD-main.cpp"),
      path.join(config.projectDir, "tests", "main.cpp"),
    );
  } else if (config.unitTestFramework === "juce") {
    fs.copyFileSync(
      path.join(templatesDir, "JUCE-Tests-CMakeLists.txt"),
      config.testsCMakeLists,
    );
    fs.copyFileSync(
      path.join(templatesDir, "JUCE-Tests-main.cpp"),
      path.join(config.projectDir, "tests", "main.cpp"),
    );
    fs.copyFileSync(
      path.join(templatesDir, "JUCE-Tests.h"),
      path.join(config.projectDir, "tests", "Tests.h"),
    );
    fs.copyFileSync(
      path.join(templatesDir, "JUCE-Tests.cpp"),
      path.join(config.projectDir, "tests", "Tests.cpp"),
    );
    fs.copyFileSync(
      path.join(templatesDir, "JUCE-Tests-discovery.cmake"),
      path.join(config.projectCmakeDir, "DiscoverTests.cmake"),
    );
  }

  setVar(config.testsCMakeLists, "PROJECT_ID", config.projectID);
  clearUnsetVars(config.testsCMakeLists);
}
