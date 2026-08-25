cmake_minimum_required(VERSION 3.22)
project("VAR_PROJECT_NAME" VERSION 1.0.0)

list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")
include(CommonConfig)

VAR_INIT_CPM
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

target_compile_definitions(VAR_PROJECT_ID
PRIVATE
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    PROJECT_NAME_STRING="$<TARGET_PROPERTY:VAR_PROJECT_ID,JUCE_PRODUCT_NAME>"
    PROJECT_VERSION_STRING="$<TARGET_PROPERTY:VAR_PROJECT_ID,JUCE_VERSION>"
)

target_compile_features(VAR_PROJECT_ID
PRIVATE
    cxx_std_23
)

target_link_libraries(VAR_PROJECT_ID
PRIVATE
    VAR_LINK_LIBRARIES

    juce::juce_recommended_config_flags
    juce::juce_recommended_warning_flags
    juce::juce_recommended_lto_flags
)

target_compile_options(VAR_PROJECT_ID
PRIVATE
    # Display warnings and errors in colour
    $<$<CXX_COMPILER_ID:AppleClang,Clang,GNU>:-fdiagnostics-color=always>

    # Use maximum optimisations with aggressive math optimisations
    $<$<AND:$<CXX_COMPILER_ID:AppleClang,Clang,GNU>,$<NOT:$<CONFIG:DEBUG>>>:-ffast-math>
    $<$<AND:$<CXX_COMPILER_ID:MSVC>,$<NOT:$<CONFIG:DEBUG>>>:/fp:fast>
    $<$<AND:$<CXX_COMPILER_ID:MSVC>,$<NOT:$<CONFIG:DEBUG>>>:/Ox>
)

include(CTest)
add_subdirectory(tests)
