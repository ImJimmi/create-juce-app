include_guard()

function(add_installation_rules)
    set(OPTIONS "")
    set(ONE_VALUE_KEYWORDS "")
    set(MULTI_VALUE_KEYWORDS PRODUCT_NAMES TARGETS)
    cmake_parse_arguments (INSTALLER "${OPTIONS}" "${ONE_VALUE_KEYWORDS}" "${MULTI_VALUE_KEYWORDS}" ${ARGN})

    if (NOT INSTALLER_TARGETS)
        message(FATAL_ERROR "Must specify at least one target to add installation rules for")
    endif()

    if (NOT INSTALLER_PRODUCT_NAMES)
        set(INSTALLER_PRODUCT_NAMES "${PROJECT_NAME}")
    endif()

    set(PLUGIN_FORMATS AAX AU AUv3 LV2 Standalone Unity VST VST3)

    foreach(TARGET_NAME IN LISTS INSTALLER_TARGETS)
        get_target_property(ACTIVE_PLUGIN_TARGETS ${TARGET_NAME} JUCE_ACTIVE_PLUGIN_TARGETS)

        if (ACTIVE_PLUGIN_TARGETS)
            foreach(PLUGIN_TARGET IN LISTS ACTIVE_PLUGIN_TARGETS)
                foreach(FORMAT IN LISTS PLUGIN_FORMATS)
                    if ("${PLUGIN_TARGET}" MATCHES "_${FORMAT}$")
                        list(APPEND ${FORMAT}_TARGETS "${PLUGIN_TARGET}")
                        break()
                    endif()
                endforeach()
            endforeach()
        else()
            list(APPEND Standalone_TARGETS "${TARGET_NAME}")
        endif()
    endforeach()

    set(CPACK_PACKAGE_NAME "${PROJECT_NAME}" CACHE INTERNAL "")
    set(CPACK_PACKAGE_VERSION "${PROJECT_VERSION}")
    set(CPACK_PACKAGE_FILE_NAME "${PROJECT_NAME} v${PROJECT_VERSION}")
    set(CPACK_PACKAGE_FILE_NAME ${CPACK_PACKAGE_FILE_NAME} PARENT_SCOPE)

    set(CPACK_RESOURCE_FILE_LICENSE "${CMAKE_CURRENT_SOURCE_DIR}/installer/License.rtf")
    set(CPACK_RESOURCE_FILE_README  "${CMAKE_CURRENT_SOURCE_DIR}/installer/ReadMe.rtf")

    if (APPLE)
        set(CPACK_GENERATOR "productbuild")
        set(CPACK_PACKAGING_INSTALL_PREFIX "/")

        set(AAX_DESTINATION        "Library/Application Support/Avid/Audio/Plug-Ins")
        set(AU_DESTINATION         "Library/Audio/Plug-Ins/Components")
        set(LV2_DESTINATION        "Library/Audio/Plug-Ins/LV2")
        set(Standalone_DESTINATION "Applications")
        set(Unity_DESTINATION      "Library/Audio/Plug-Ins/Unity")
        set(VST_DESTINATION        "Library/Audio/Plug-Ins/VST")
        set(VST3_DESTINATION       "Library/Audio/Plug-Ins/VST3")
    elseif(WIN32)
        set(CPACK_GENERATOR "NSIS")

        set(AAX_DESTINATION        "AAX")
        set(LV2_DESTINATION        "LV2")
        set(Standalone_DESTINATION "bin")
        set(Unity_DESTINATION      "Unity")
        set(VST_DESTINATION        "VST")
        set(VST3_DESTINATION       "VST3")

        set(AAX_SYSTEM_DIR  "$PROGRAMFILES64\\\\Common Files\\\\Avid\\\\Audio\\\\Plug-Ins")
        set(LV2_SYSTEM_DIR  "$PROGRAMFILES64\\\\Common Files\\\\LV2")
        set(VST_SYSTEM_DIR  "$PROGRAMFILES64\\\\Common Files\\\\VST2")
        set(VST3_SYSTEM_DIR "$PROGRAMFILES64\\\\Common Files\\\\VST3")

        set(AAX_FILE_NAME_SUFFIX  ".aaxplugin")
        set(LV2_FILE_NAME_SUFFIX  ".lv2")
        set(VST_FILE_NAME_SUFFIX  ".dll")
        set(VST3_FILE_NAME_SUFFIX ".vst3")

        set(AAX_REMOVE_COMMAND  "RMDir /r")
        set(LV2_REMOVE_COMMAND  "RMDir /r")
        set(VST_REMOVE_COMMAND  "Delete")
        set(VST3_REMOVE_COMMAND "RMDir /r")

        foreach(FORMAT IN LISTS PLUGIN_FORMATS)
            if (NOT ${FORMAT}_TARGETS OR NOT ${FORMAT}_SYSTEM_DIR)
                continue()
            endif()

            string(APPEND
                CPACK_NSIS_EXTRA_INSTALL_COMMANDS
                "\n  CreateDirectory \\\"${${FORMAT}_SYSTEM_DIR}\\\"")

            foreach(PRODUCT IN LISTS INSTALLER_PRODUCT_NAMES)
                set(FILE_NAME "${PRODUCT}${${FORMAT}_FILE_NAME_SUFFIX}")

                string(APPEND
                    CPACK_NSIS_EXTRA_INSTALL_COMMANDS
                    "\n  CopyFiles \\\"$INSTDIR\\\\${${FORMAT}_DESTINATION}\\\\${FILE_NAME}\\\" \\\"${${FORMAT}_SYSTEM_DIR}\\\"")

                string(APPEND
                    CPACK_NSIS_EXTRA_UNINSTALL_COMMANDS
                    "\n  ${${FORMAT}_REMOVE_COMMAND} \\\"${${FORMAT}_SYSTEM_DIR}\\\\${FILE_NAME}\\\"")
            endforeach()
        endforeach()
    endif()

    foreach(FORMAT IN LISTS PLUGIN_FORMATS)
        if (NOT ${FORMAT}_TARGETS OR NOT ${FORMAT}_DESTINATION)
            continue()
        endif()

        if ("${FORMAT}" STREQUAL "Standalone")
            set(COMPONENT_NAME "Applications")
        else()
            set(COMPONENT_NAME "${FORMAT}_Plugins")
        endif()

        install(
            TARGETS ${${FORMAT}_TARGETS}
            DESTINATION "${${FORMAT}_DESTINATION}"
            COMPONENT "${COMPONENT_NAME}"
        )
    endforeach()

    include(CPack)
endfunction()
