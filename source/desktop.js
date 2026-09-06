import fs from "node:fs";
import path from "node:path";

import { setVar, templatesDir } from "./utils.js";

export async function populateDesktopSpecificCMakeTemplates(config) {
  setVar(
    config.projectCMakeLists,
    "JUCE_ADD_TARGET_FUNCTION",
    "juce_add_gui_app",
  );
  setVar(
    config.projectCMakeLists,
    "ICONS",
    'ICON_BIG "${PROJECT_SOURCE_DIR}/assets/Icon-512x.png"\n    ICON_SMALL "${PROJECT_SOURCE_DIR}/assets/Icon-256x.png"\n    ICON_COMPOSER_BUNDLE "${PROJECT_SOURCE_DIR}/assets/AppIcon.icon"',
  );

  fs.copyFileSync(
    path.join(templatesDir, "gui-app-main.cpp"),
    path.join(config.projectSourceDir, "main.cpp"),
  );
  setVar(
    path.join(config.projectSourceDir, "main.cpp"),
    "PROJECT_ID",
    config.projectID,
  );
  fs.mkdirSync(path.join(config.projectSourceDir, "gui"));
  fs.copyFileSync(
    path.join(templatesDir, "gui-app-window.h"),
    path.join(config.projectSourceDir, "gui", "Window.h"),
  );
  setVar(
    config.projectCMakeLists,
    "SOURCES",
    path.join("${PROJECT_SOURCE_DIR}", config.relativeSourceDir, "main.cpp"),
  );

  if (config.guiAPI === "component") {
    fs.copyFileSync(
      path.join(templatesDir, "gui-app-main-component-JUCE.h"),
      path.join(config.projectSourceDir, "gui", "MainComponent.h"),
    );

    setVar(
      config.projectCMakeLists,
      "COMPILE_DEFINITIONS",
      "JUCE_WEB_BROWSER=0",
    );
    setVar(config.projectCMakeLists, "LINK_LIBRARIES", "juce::juce_gui_basics");
  } else if (config.guiAPI === "webview") {
    fs.copyFileSync(
      path.join(templatesDir, "SinglePageBrowserComponent.h"),
      path.join(config.projectSourceDir, "gui", "SinglePageBrowserComponent.h"),
    );
    fs.copyFileSync(
      path.join(templatesDir, "SinglePageBrowserComponent.mm"),
      path.join(
        config.projectSourceDir,
        "gui",
        "SinglePageBrowserComponent.mm",
      ),
    );
    fs.copyFileSync(
      path.join(templatesDir, "gui-app-main-component-webview.h"),
      path.join(config.projectSourceDir, "gui", "MainComponent.h"),
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
      "gui",
    );

    setVar(
      config.projectCMakeLists,
      "COMPILE_DEFINITIONS",
      "JUCE_WEB_BROWSER=1",
    );
    setVar(config.projectCMakeLists, "LINK_LIBRARIES", "juce::juce_gui_extra");
    setVar(
      config.projectCMakeLists,
      "ADD_WEB_FRONTEND",
      `include(WebFrontend)\nadd_web_frontend(${config.projectID})\n`,
    );
  }
}
