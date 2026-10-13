import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { clearUnsetVars, setVar, templatesDir } from "./utils.js";

export function addNonTemplatedProjectFiles(config) {
  fs.mkdirSync(config.projectSourceDir, { recursive: true });
  fs.mkdirSync(config.projectCmakeDir);
  fs.mkdirSync(config.projectAssetsDir);
  fs.mkdirSync(config.projectInstallersDir);
  fs.mkdirSync(config.projectGhaWorkflowsDir, { recursive: true });
  fs.mkdirSync(config.projectGhaActionsDir, { recursive: true });
  fs.mkdirSync(config.projectVscodeDir);

  // .gitignore
  fs.writeFileSync(
    path.join(config.projectDir, ".gitignore"),
    "build/\nCPM_modules/\nCMakeUserPresets.json",
  );

  // Main CMakeLists.txt
  fs.copyFileSync(
    path.join(templatesDir, "CMakeLists.txt"),
    config.projectCMakeLists,
  );

  // Formatters and Linters
  fs.copyFileSync(
    path.join(import.meta.dirname, "..", ".clang-format"),
    path.join(config.projectDir, ".clang-format"),
  );
  fs.copyFileSync(
    path.join(import.meta.dirname, "..", ".clang-tidy"),
    path.join(config.projectDir, ".clang-tidy"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "ClangTidy.cmake"),
    path.join(config.projectCmakeDir, "ClangTidy.cmake"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "RunClangTidy.cmake"),
    path.join(config.projectCmakeDir, "RunClangTidy.cmake"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "CppCheck.cmake"),
    path.join(config.projectCmakeDir, "CppCheck.cmake"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "RunCppCheck.cmake"),
    path.join(config.projectCmakeDir, "RunCppCheck.cmake"),
  );

  // General CMake
  fs.copyFileSync(
    path.join(templatesDir, "CommonConfig.cmake"),
    path.join(config.projectCmakeDir, "CommonConfig.cmake"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "CMakePresets.json"),
    path.join(config.projectDir, "CMakePresets.json"),
  );

  // Assets
  fs.cpSync(
    path.join(templatesDir, "macOS_icon.icon"),
    path.join(config.projectAssetsDir, "AppIcon.icon"),
    { recursive: true },
  );
  fs.copyFileSync(
    path.join(templatesDir, "Icon-512x.png"),
    path.join(config.projectAssetsDir, "Icon-512x.png"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "Icon-256x.png"),
    path.join(config.projectAssetsDir, "Icon-256x.png"),
  );

  // Installers
  fs.copyFileSync(
    path.join(templatesDir, "License.rtf"),
    path.join(config.projectInstallersDir, "License.rtf"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "ReadMe.rtf"),
    path.join(config.projectInstallersDir, "ReadMe.rtf"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "Installers.cmake"),
    path.join(config.projectCmakeDir, "Installers.cmake"),
  );

  // VS Code
  fs.copyFileSync(
    path.join(templatesDir, "launch.json"),
    path.join(config.projectVscodeDir, "launch.json"),
  );

  // GitHub Actions
  fs.copyFileSync(
    path.join(templatesDir, "github-workflows-build.yml"),
    path.join(config.projectGhaWorkflowsDir, "build.yml"),
  );
  fs.mkdirSync(path.join(config.projectGhaActionsDir, "install-dependencies"));
  fs.mkdirSync(
    path.join(config.projectGhaActionsDir, "import-signing-certificates"),
  );
  fs.copyFileSync(
    path.join(templatesDir, "github-actions-install-dependencies.yml"),
    path.join(
      path.join(config.projectGhaActionsDir, "install-dependencies"),
      "action.yml",
    ),
  );
  fs.copyFileSync(
    path.join(templatesDir, "github-actions-import-signing-certificates.yml"),
    path.join(
      path.join(config.projectGhaActionsDir, "import-signing-certificates"),
      "action.yml",
    ),
  );
}

export function addLicense(config) {
  if (config.license === "none") return;

  const license = path.join(config.projectDir, "LICENSE");
  fs.copyFileSync(
    path.join(templatesDir, "licenses", `${config.license}.txt`),
    license,
  );

  const content = fs.readFileSync(license, { encoding: "utf8" });
  fs.writeFileSync(
    license,
    content.replace(
      "<year> <copyright holders>",
      `${new Date().getFullYear()} ${config.companyName}`,
    ),
    { encoding: "utf8" },
  );
}

function getAudioUnitType(config) {
  if (config.pluginType === "midi") return "aumi";
  if (config.pluginType === "synth") return "aumu";
  if (config.midiIO.includes("needsMidiInput")) return "aumf";

  return "aufx";
}

function getJustExecutable(config) {
  const directory = config.projectType === "plugin" ? '"Standalone" / ' : "";
  const macOSExecutable =
    config.projectType === "console"
      ? "product"
      : 'product + ".app/Contents/MacOS/" + product';

  return `if os() == "macos" { ${directory}${macOSExecutable} } else if os() == "windows" { ${directory}product + ".exe" } else { ${directory}product }`;
}

export function addJustfile(config) {
  const justfile = path.join(config.projectDir, "justfile");
  const isPlugin = config.projectType === "plugin";
  const hasRun = !isPlugin || config.pluginFormats.includes("Standalone");
  const hasPluginval = isPlugin && config.pluginFormats.includes("VST3");
  const hasAuval = isPlugin && config.pluginFormats.includes("AU");

  const templates = [
    "justfile",
    hasRun && "justfile-run",
    hasPluginval && "justfile-pluginval",
    hasAuval && "justfile-auval",
  ].filter(Boolean);

  fs.writeFileSync(
    justfile,
    templates
      .map((template) =>
        fs.readFileSync(path.join(templatesDir, template), {
          encoding: "utf8",
        }),
      )
      .join("\n"),
    { encoding: "utf8" },
  );

  setVar(justfile, "PROJECT_ID", config.projectID);
  setVar(justfile, "PROJECT_NAME", config.projectName);

  if (hasRun) {
    setVar(justfile, "EXECUTABLE", getJustExecutable(config));
  }

  if (hasAuval) {
    setVar(justfile, "AU_TYPE", getAudioUnitType(config));
    setVar(justfile, "PLUGIN_CODE", config.pluginCode);
    setVar(
      justfile,
      "PLUGIN_MANUFACTURER_CODE",
      config.pluginManufacturerCode,
    );
  }
}

export function addREADME(config) {
  const README = path.join(config.projectDir, "README.md");
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
}
