#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const outputDir = path.resolve(process.argv[2] ?? "configs");

const dependencySetups = [
  { dependencyType: "cpm" },
  { dependencyType: "fetchContent" },
  { dependencyType: "submodule" },
];

const defaultUnitTestFramework = { unitTestFramework: "none" };
const otherUnitTestFrameworks = [
  { unitTestFramework: "catch2" },
  { unitTestFramework: "googletest" },
  { unitTestFramework: "doctest" },
  { unitTestFramework: "juce" },
  { unitTestFramework: "none" },
];

const guiAPIs = [
  { guiAPI: "component" },
  { guiAPI: "webview", webFramework: "svelte", webLanguage: "typescript" },
];
const dspAPIs = [
  { dspAPI: "basic" },
  { dspAPI: "juce_dsp" },
  { dspAPI: "gamma" },
];

function cross(...axes) {
  return axes.reduce(
    (permutations, axis) =>
      permutations.flatMap((permutation) =>
        axis.map((options) => ({ ...permutation, ...options })),
      ),
    [{}],
  );
}

const projectTypes = [
  { projectType: "console" },
  ...cross([{ projectType: "desktop" }], guiAPIs),
  ...cross([{ projectType: "plugin" }], dspAPIs, guiAPIs),
];

const permutations = [
  ...cross(dependencySetups, [defaultUnitTestFramework], projectTypes),
  ...otherUnitTestFrameworks.map((unitTestFramework) => ({
    dependencyType: "cpm",
    initGit: true,
    projectType: "console",
    ...unitTestFramework,
  })),
];

function nameFor(options) {
  return [
    options.projectType,
    options.dspAPI,
    options.guiAPI,
    options.webFramework,
    options.webLanguage,
    options.dependencyType,
    options.initGit ? "git" : "no-git",
    options.unitTestFramework,
  ]
    .filter(Boolean)
    .join("-")
    .toLowerCase();
}

function configFor(options) {
  return {
    projectName: "Create JUCE App",
    companyName: "Create JUCE App CI",
    projectID: nameFor(options),
    juceVersion: "develop",
    ...options,
    ...(options.projectType === "plugin" && {
      pluginCode: "Cjap",
      pluginManufacturerCode: "Cjac",
      pluginFormats: [
        "AAX",
        "AU",
        "AUv3",
        "LV2",
        "Standalone",
        "Unity",
        "VST3",
      ],
      pluginType: "fx",
      midiIO: [],
      pluginEffectCategory: "none",
    }),
  };
}

const configs = new Map(
  permutations.map((options) => [nameFor(options), configFor(options)]),
);

fs.mkdirSync(outputDir, { recursive: true });

for (const [name, config] of configs) {
  fs.writeFileSync(
    path.join(outputDir, `${name}.json`),
    `${JSON.stringify(config, null, 2)}\n`,
    { encoding: "utf-8" },
  );
}

process.stdout.write(`${JSON.stringify([...configs.keys()])}\n`);
