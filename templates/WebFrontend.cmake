include_guard()

find_program(NPM_COMMAND npm REQUIRED)
find_program(NODE_COMMAND node REQUIRED)
cmake_path(GET NODE_COMMAND PARENT_PATH NODE_DIR)

if (WIN32)
    set(NPM_COMMAND "${NPM_COMMAND}.cmd")
endif()

function(add_web_frontend TARGET)
    target_sources(${TARGET}
    PRIVATE
        $<$<PLATFORM_ID:Darwin>:${PROJECT_SOURCE_DIR}/source/VAR_PROJECT_ID/VAR_GUI_DIR/SinglePageBrowserComponent.mm>
    )
    target_compile_definitions(${TARGET}
    PRIVATE
        JUCE_USE_WIN_WEBVIEW2=1
    )

    set(FRONTEND_SOURCE_DIR "${PROJECT_SOURCE_DIR}/frontend")
    file(GLOB_RECURSE FRONTEND_SOURCES
        "${FRONTEND_SOURCE_DIR}/index.html"
        "${FRONTEND_SOURCE_DIR}/package-lock.json"
        "${FRONTEND_SOURCE_DIR}/package.json"
        "${FRONTEND_SOURCE_DIR}/src/**/*"
        "${FRONTEND_SOURCE_DIR}/vite.config.js"
    )

    if (CMAKE_GENERATOR MATCHES "Xcode")
        set(PATH_ENV "PATH=\"${NODE_DIR}:$PATH\"")
    else()
        set(PATH_ENV "")
    endif()

    add_custom_command(
        POST_BUILD
        TARGET ${TARGET}
        COMMAND ${CMAKE_COMMAND} -E echo "Installing NPM dependencies..."
        COMMAND ${CMAKE_COMMAND} -E env "${PATH_ENV}" ${NPM_COMMAND} $<$<CONFIG:Debug>:install>$<$<CONFIG:Release>:ci>
        WORKING_DIRECTORY ${FRONTEND_SOURCE_DIR}
    )

    add_custom_command(
        POST_BUILD
        TARGET ${TARGET}
        COMMAND ${CMAKE_COMMAND} -E echo "Building frontend app at ${CMAKE_CURRENT_SOURCE_DIR}/frontend"
        COMMAND ${CMAKE_COMMAND} -E env "${PATH_ENV}" ${NPM_COMMAND} run build
        WORKING_DIRECTORY ${FRONTEND_SOURCE_DIR}
    )
    add_custom_command(
        POST_BUILD
        TARGET ${TARGET}
        COMMAND ${CMAKE_COMMAND} -E echo "Zipping ${CMAKE_CURRENT_SOURCE_DIR}/frontend/dist"
        COMMAND ${CMAKE_COMMAND} -E tar "cf" "${CMAKE_CURRENT_BINARY_DIR}/frontend.zip" --format=zip -- .
        WORKING_DIRECTORY ${FRONTEND_SOURCE_DIR}/dist
    )

    get_target_property(INDIVIDUAL_TARGETS ${TARGET} JUCE_ACTIVE_PLUGIN_TARGETS)

    if (NOT INDIVIDUAL_TARGETS)
        set(INDIVIDUAL_TARGETS ${TARGET})
    endif()

    foreach(TARG IN LISTS INDIVIDUAL_TARGETS)
        if (APPLE)
            if ("${TARG}" MATCHES "^${TARGET}_LV2$")
                set(RESOURCES_DIR "$<TARGET_FILE:${TARG}>/Contents/Resources")
            else()
                set(RESOURCES_DIR "$<TARGET_BUNDLE_DIR:${TARG}>/Contents/Resources")
            endif()
        else()
            if ("${TARG}" MATCHES "^${TARGET}_(AAX|AU|AUv3|LV2|Unity|VST|VST3)$")
                set(RESOURCES_DIR "$<TARGET_FILE_DIR:${TARG}>/../Resources")
            else()
                set(RESOURCES_DIR "$<TARGET_FILE_DIR:${TARG}>")
            endif()
        endif()

        add_custom_command(
            POST_BUILD
            TARGET ${TARG}
            COMMAND ${CMAKE_COMMAND} -E echo "Copying ${CMAKE_CURRENT_BINARY_DIR}/frontend.zip to ${RESOURCES_DIR}..."
            COMMAND ${CMAKE_COMMAND} -E make_directory "${RESOURCES_DIR}"
            COMMAND ${CMAKE_COMMAND} -E copy "${CMAKE_CURRENT_BINARY_DIR}/frontend.zip" "${RESOURCES_DIR}/frontend.zip"
        )
    endforeach()

    if (WIN32)
        if (NOT JUCE_SOURCE_DIR)
            message(FATAL_ERROR "The JUCE_SOURCE_DIR variable hasn't be specified so the juce_webview2 library can't be found")
            return()
        endif()

        set(JUCE_CMAKE_UTILS_DIR "${JUCE_SOURCE_DIR}/extras/Build/CMake")
        
        if(NOT ("${JUCE_CMAKE_UTILS_DIR}" IN_LIST CMAKE_MODULE_PATH))
            list(APPEND CMAKE_MODULE_PATH "${JUCE_CMAKE_UTILS_DIR}")
        endif()

        find_package(WebView2 REQUIRED)

        target_link_libraries(${TARGET}
        PUBLIC
            juce::juce_webview2
        )
    endif()
endfunction()
