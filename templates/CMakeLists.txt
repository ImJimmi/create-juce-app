cmake_minimum_required(VERSION 3.22)
project("VAR_PROJECT_NAME" VERSION 1.0.0)

VAR_ADD_JUCE_DEPENDENCY

VAR_JUCE_ADD_TARGET_FUNCTION(
    VAR_PROJECT_ID
    VAR_PLUGIN_FORMATS
)

target_sources(VAR_PROJECT_ID
PRIVATE
    VAR_SOURCES
)

target_include_directories(VAR_PROJECT_ID
PRIVATE
    ${PROJECT_SOURCE_DIR}/source
)

target_link_libraries(VAR_PROJECT_ID
PRIVATE
    VAR_LINK_LIBRARIES

    juce::juce_recommended_config_flags
    juce::juce_recommended_warning_flags
    juce::juce_recommended_lto_flags
)

target_compile_definitions(VAR_PROJECT_ID
PRIVATE
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    PROJECT_NAME_STRING="$<TARGET_PROPERTY:VAR_PROJECT_ID,JUCE_PRODUCT_NAME>"
    PROJECT_VERSION_STRING="$<TARGET_PROPERTY:VAR_PROJECT_ID,JUCE_VERSION>"
)
