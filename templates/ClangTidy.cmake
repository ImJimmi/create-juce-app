include_guard()

find_program(CLANG_TIDY_COMMAND clang-tidy)

if(NOT CLANG_TIDY_COMMAND)
    if (APPLE)
        message(WARNING "clang-tidy not found. Install using\n  $ brew install llvm\n  Then add $(brew --prefix llvm)/bin to your PATH")
    elseif(WIN32)
        message(WARNING "clang-tidy not found. Install using\n  $ winget install LLVM.LLVM\n  Or install the 'C++ Clang tools for Windows' Visual Studio component")
    endif()
endif()

function(add_clang_tidy TARGET)
    if (NOT CLANG_TIDY_COMMAND)
        return()
    endif()

    set(OPTIONS "")
    set(ONE_VALUE_KEYWORDS HEADER_FILTER)
    set(MULTI_VALUE_KEYWORDS "")
    cmake_parse_arguments (CLANG_TIDY "${OPTIONS}" "${ONE_VALUE_KEYWORDS}" "${MULTI_VALUE_KEYWORDS}" ${ARGN})

    if (NOT CLANG_TIDY_HEADER_FILTER)
        set(CLANG_TIDY_HEADER_FILTER "${PROJECT_SOURCE_DIR}/source/*|${PROJECT_SOURCE_DIR}/tests/*")
    endif()

    set(CLANG_TIDY_PROPERTIES
        "${CMAKE_COMMAND}"
        "-DCLANG_TIDY_HEADER_FILTER=${CLANG_TIDY_HEADER_FILTER}"
        "-DCLANG_TIDY_CONFIG=${PROJECT_SOURCE_DIR}/.clang-tidy"
        "-DCLANG_TIDY_BUILD_DIR=${PROJECT_BINARY_DIR}"
        -P
        "${PROJECT_SOURCE_DIR}/cmake/ClangTidy.cmake"
    )

    set_target_properties(${TARGET}
    PROPERTIES
        CXX_CLANG_TIDY "${CLANG_TIDY_PROPERTIES}"
    )
endfunction()

if(CMAKE_SCRIPT_MODE_FILE)
    if(NOT CLANG_TIDY_COMMAND)
        message(FATAL_ERROR "clang-tidy not found")
    endif()

    set(FILTERED_ARGS "")
    set(START_OF_CLANG_TIDY_ARGS OFF)
    math(EXPR last_arg "${CMAKE_ARGC} - 1")
    set(LAST_ARG "")

    foreach(i RANGE 0 ${last_arg})
        set(ARG "${CMAKE_ARGV${i}}")

        if(NOT START_OF_CLANG_TIDY_ARGS)
            if(ARG MATCHES ".*/ClangTidy.cmake$")
                set(START_OF_CLANG_TIDY_ARGS ON)
            endif()

            continue()
        endif()

        if(ARG STREQUAL "--")
            if (LAST_ARG MATCHES ".*(.cache|JuceLibraryCode|submodules|_deps).*|.*.mm")
                cmake_language(EXIT 0)
            endif()
        endif()

        set(LAST_ARG ${ARG})

        if(ARG STREQUAL "-GL")
            continue()
        elseif(ARG MATCHES "^/GL$")
            continue()
        else()
            list(APPEND FILTERED_ARGS "${ARG}")
        endif()
    endforeach()

    execute_process(
        COMMAND ${CLANG_TIDY_COMMAND} "--header-filter=${CLANG_TIDY_HEADER_FILTER}" "--config-file=${CLANG_TIDY_CONFIG}" -p "${CLANG_TIDY_BUILD_DIR}" ${FILTERED_ARGS}
        RESULT_VARIABLE RESULT
    )

    if(NOT RESULT EQUAL 0)
        message(FATAL_ERROR "clang-tidy failed with exit code ${RESULT}")
    endif()
endif()
