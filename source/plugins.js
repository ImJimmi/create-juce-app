import fs from "node:fs";
import path from "node:path";

import { addPluginval, addGamma } from "./dependencies.js";
import { setVar, templatesDir } from "./utils.js";

const pluginEffectCategoriesMap = {
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
  none: { vst3: null, vst2: "kPlugCategEffect", aax: null },
};

export async function populatePluginSpecificCMakeTemplates(config) {
  const isSynth = config.pluginType === "synth";
  const isMidiEffect = config.pluginType === "midi";
  const needsMidiInput =
    isMidiEffect || config.midiIO.includes("needsMidiInput");
  const needsMidiOutput =
    isMidiEffect || config.midiIO.includes("needsMidiOutput");

  setVar(
    config.projectCMakeLists,
    "JUCE_ADD_TARGET_FUNCTION",
    "juce_add_plugin",
  );
  setVar(
    config.projectCMakeLists,
    "PLUGIN_CODE",
    `PLUGIN_CODE "${config.pluginCode}"`,
  );
  setVar(
    config.projectCMakeLists,
    "PLUGIN_MANUFACTURER_CODE",
    `PLUGIN_MANUFACTURER_CODE "${config.pluginManufacturerCode}"`,
  );
  setVar(
    config.projectCMakeLists,
    "PLUGIN_FORMATS",
    `FORMATS ${config.pluginFormats.join(" ")}`,
  );

  if (config.pluginFormats.includes("VST")) {
    setVar(
      config.projectCMakeLists,
      "VST2_SDK_PATH",
      `juce_set_vst2_sdk_path("${config.vst2SdkPath}")`,
    );
  }
  if (config.pluginFormats.includes("LV2")) {
    setVar(
      config.projectCMakeLists,
      "LV2_URI",
      `LV2URI "urn:${config.bundleID}"`,
    );
  }

  const pluginCharacteristics = [
    isSynth && "IS_SYNTH TRUE",
    needsMidiInput && "NEEDS_MIDI_INPUT TRUE",
    needsMidiOutput && "NEEDS_MIDI_OUTPUT TRUE",
    isMidiEffect && "IS_MIDI_EFFECT TRUE",
  ].filter(Boolean);

  if (pluginCharacteristics.length > 0) {
    setVar(
      config.projectCMakeLists,
      "PLUGIN_CHARACTERISTICS",
      pluginCharacteristics.join("\n    "),
    );
  }

  const effectCategory = pluginEffectCategoriesMap[config.pluginEffectCategory];
  const vst3Category = effectCategory.vst3?.includes(" ")
    ? `"${effectCategory.vst3}"`
    : effectCategory.vst3;
  const pluginCategories = [
    `VST3_CATEGORIES Fx` + (vst3Category ? ` ${vst3Category}` : ""),
    effectCategory.vst2 !== "kPlugCategEffect" &&
      `VST2_CATEGORY ${effectCategory.vst2}`,
    effectCategory.aax && `AAX_CATEGORY ${effectCategory.aax}`,
  ].filter(Boolean);
  setVar(
    config.projectCMakeLists,
    "PLUGIN_CATEGORIES",
    pluginCategories.join("\n    "),
  );

  setVar(
    config.projectCMakeLists,
    "ICONS",
    'ICON_BIG "${PROJECT_SOURCE_DIR}/assets/Icon-512x.png"\n    ICON_SMALL "${PROJECT_SOURCE_DIR}/assets/Icon-256x.png"',
  );

  fs.copyFileSync(
    path.join(templatesDir, "plugin-create-plugin-filter.cpp"),
    path.join(config.projectSourceDir, "CreatePluginFilter.cpp"),
  );
  setVar(
    path.join(config.projectSourceDir, "CreatePluginFilter.cpp"),
    "PROJECT_ID",
    config.projectID,
  );

  fs.copyFileSync(
    path.join(templatesDir, "plugin-processor.h"),
    path.join(config.projectSourceDir, "Processor.h"),
  );
  setVar(
    path.join(config.projectSourceDir, "Processor.h"),
    "PROJECT_ID",
    config.projectID,
  );
  setVar(
    path.join(config.projectSourceDir, "Processor.h"),
    "NEEDS_MIDI_INPUT",
    needsMidiInput ? "true" : "false",
  );
  setVar(
    path.join(config.projectSourceDir, "Processor.h"),
    "NEEDS_MIDI_OUTPUT",
    needsMidiOutput ? "true" : "false",
  );
  setVar(
    path.join(config.projectSourceDir, "Processor.h"),
    "IS_MIDI_EFFECT",
    isMidiEffect ? "true" : "false",
  );

  fs.mkdirSync(path.join(config.projectSourceDir, "audio"));

  if (config.dspAPI === "basic") {
    if (isSynth) {
      fs.copyFileSync(
        path.join(templatesDir, "synth-main-audio-processor-basic.h"),
        path.join(config.projectSourceDir, "audio", "MainAudioProcessor.h"),
      );
      setVar(
        path.join(config.projectSourceDir, "Processor.h"),
        "PROCESS_BLOCK_IMPL",
        "mainAudioProcessor->processBlock(audioBuffer, midiBuffer);",
      );
    } else {
      fs.copyFileSync(
        path.join(templatesDir, "plugin-main-audio-processor-basic.h"),
        path.join(config.projectSourceDir, "audio", "MainAudioProcessor.h"),
      );
      setVar(
        path.join(config.projectSourceDir, "Processor.h"),
        "PROCESS_BLOCK_IMPL",
        "juce::ignoreUnused(midiBuffer);\nmainAudioProcessor->processBlock(audioBuffer);",
      );
    }

    setVar(
      path.join(config.projectSourceDir, "Processor.h"),
      "PREPARE_TO_PLAY_IMPL",
      "mainAudioProcessor = std::make_unique<MainAudioProcessor>(sampleRate,\n                                                                  expectedBlockSize,\n                                                                  getMainBusNumOutputChannels(),\n                                                                  apvts);",
    );
  } else if (config.dspAPI === "juce_dsp") {
    if (isSynth) {
      fs.copyFileSync(
        path.join(templatesDir, "synth-main-audio-processor-juce_dsp.h"),
        path.join(config.projectSourceDir, "audio", "MainAudioProcessor.h"),
      );
      setVar(
        path.join(config.projectSourceDir, "Processor.h"),
        "PROCESS_BLOCK_IMPL",
        "mainAudioProcessor->processBlock(audioBuffer, midiBuffer);",
      );
    } else {
      fs.copyFileSync(
        path.join(templatesDir, "plugin-main-audio-processor-juce_dsp.h"),
        path.join(config.projectSourceDir, "audio", "MainAudioProcessor.h"),
      );
      setVar(
        path.join(config.projectSourceDir, "Processor.h"),
        "PROCESS_BLOCK_IMPL",
        "juce::ignoreUnused(midiBuffer);\njuce::dsp::AudioBlock<float> block{ audioBuffer };\n        const juce::dsp::ProcessContextReplacing context{ block };\n        mainAudioProcessor->process(context);",
      );
    }

    setVar(
      path.join(config.projectSourceDir, "Processor.h"),
      "PREPARE_TO_PLAY_IMPL",
      "const juce::dsp::ProcessSpec spec{\n            sampleRate,\n            static_cast<juce::uint32>(expectedBlockSize),\n            static_cast<juce::uint32>(getMainBusNumOutputChannels()),\n        };\n        mainAudioProcessor = std::make_unique<MainAudioProcessor>(spec, apvts);",
    );
  } else if (config.dspAPI === "gamma") {
    addGamma(config);

    if (isSynth) {
      fs.copyFileSync(
        path.join(templatesDir, "synth-main-audio-processor-gamma.h"),
        path.join(config.projectSourceDir, "audio", "MainAudioProcessor.h"),
      );
      setVar(
        path.join(config.projectSourceDir, "Processor.h"),
        "PROCESS_BLOCK_IMPL",
        "mainAudioProcessor->processBlock(audioBuffer, midiBuffer);",
      );
    } else {
      fs.copyFileSync(
        path.join(templatesDir, "plugin-main-audio-processor-gamma.h"),
        path.join(config.projectSourceDir, "audio", "MainAudioProcessor.h"),
      );
      setVar(
        path.join(config.projectSourceDir, "Processor.h"),
        "PROCESS_BLOCK_IMPL",
        "juce::ignoreUnused(midiBuffer);\nmainAudioProcessor->processBlock(audioBuffer);",
      );
    }

    setVar(
      path.join(config.projectSourceDir, "Processor.h"),
      "PREPARE_TO_PLAY_IMPL",
      "mainAudioProcessor = std::make_unique<MainAudioProcessor>(sampleRate,\n                                                                  expectedBlockSize,\n                                                                  getMainBusNumOutputChannels(),\n                                                                  apvts);",
    );
  }

  fs.copyFileSync(
    path.join(templatesDir, "plugin-parameters.h"),
    path.join(config.projectSourceDir, "audio", "Parameters.h"),
  );
  fs.mkdirSync(path.join(config.projectSourceDir, "editor"));
  setVar(
    config.projectCMakeLists,
    "SOURCES",
    path.join(
      "${PROJECT_SOURCE_DIR}",
      config.relativeSourceDir,
      "CreatePluginFilter.cpp",
    ),
  );
  setVar(
    config.projectCMakeLists,
    "LINK_LIBRARIES",
    `juce::juce_audio_utils${config.dspAPI === "juce_dsp" ? "\njuce::juce_dsp" : ""}`,
  );

  if (config.guiAPI === "component") {
    fs.copyFileSync(
      path.join(templatesDir, "plugin-editor-JUCE.h"),
      path.join(config.projectSourceDir, "editor", "Editor.h"),
    );
    setVar(
      path.join(config.projectSourceDir, "editor", "Editor.h"),
      "PROJECT_ID",
      config.projectID,
    );
  } else if (config.guiAPI === "webview") {
    fs.copyFileSync(
      path.join(templatesDir, "plugin-editor-webview.h"),
      path.join(config.projectSourceDir, "editor", "Editor.h"),
    );
    fs.copyFileSync(
      path.join(templatesDir, "SinglePageBrowserComponent.h"),
      path.join(
        config.projectSourceDir,
        "editor",
        "SinglePageBrowserComponent.h",
      ),
    );
    fs.copyFileSync(
      path.join(templatesDir, "SinglePageBrowserComponent.mm"),
      path.join(
        config.projectSourceDir,
        "editor",
        "SinglePageBrowserComponent.mm",
      ),
    );

    fs.copyFileSync(
      path.join(templatesDir, "WebFrontend.cmake"),
      path.join(config.projectCmakeDir, "WebFrontend.cmake"),
    );
    setVar(
      path.join(config.projectCmakeDir, "WebFrontend.cmake"),
      "PROJECT_ID",
      config.projectID,
    );
    setVar(
      path.join(config.projectCmakeDir, "WebFrontend.cmake"),
      "GUI_DIR",
      "editor",
    );
    setVar(
      config.projectCMakeLists,
      "ADD_WEB_FRONTEND",
      `include(WebFrontend)\nadd_web_frontend(${config.projectID})\n`,
    );
  }

  await addPluginval(config);
}
