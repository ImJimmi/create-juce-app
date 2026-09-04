include_guard()

find_program(CPPCHECK_COMMAND cppcheck)

if(NOT CPPCHECK_COMMAND)
    if (APPLE)
        message(WARNING "cppcheck not found. Install using\n  $ brew install cppcheck")
    elseif(WIN32)
        message(WARNING "cppcheck not found. Install using\n  $ choco install cppcheck")
    endif()
endif()

function(add_cppcheck TARGET)
    if (NOT CPPCHECK_COMMAND)
        return()
    endif()

    if (CMAKE_GENERATOR MATCHES ".*Visual Studio.*")
      set(CPPCHECK_TEMPLATE "vs")
    else()
      set(CPPCHECK_TEMPLATE "gcc")
    endif()

    set(CPPCHECK_PROPERTIES
        "${CMAKE_COMMAND}"
        "-DCPPCHECK_TEMPLATE=${CPPCHECK_TEMPLATE}"
        -P
        "${PROJECT_SOURCE_DIR}/cmake/CppCheck.cmake"
        --
    )

    set_target_properties(${TARGET}
    PROPERTIES
        CXX_CPPCHECK "${CPPCHECK_PROPERTIES}"
    )
endfunction()

if(CMAKE_SCRIPT_MODE_FILE)
    if(NOT CPPCHECK_COMMAND)
        message(FATAL_ERROR "cppcheck not found")
    endif()

    set(FORWARDED_ARGS "")
    set(START_OF_CPPCHECK_ARGS OFF)
    set(SKIPPED_SEPARATOR OFF)
    math(EXPR LAST_ARG "${CMAKE_ARGC} - 1")

    foreach(i RANGE 0 ${LAST_ARG})
        set(ARG "${CMAKE_ARGV${i}}")

        if(NOT START_OF_CPPCHECK_ARGS)
            if(ARG MATCHES ".*/CppCheck.cmake$")
                set(START_OF_CPPCHECK_ARGS ON)
            endif()

            continue()
        endif()

        if(NOT SKIPPED_SEPARATOR)
            set(SKIPPED_SEPARATOR ON)
            continue()
        endif()

        list(APPEND FORWARDED_ARGS "${ARG}")
    endforeach()

    # CMake appends the file being compiled as the final argument.
    list(GET FORWARDED_ARGS -1 SOURCE_FILE)

    if (SOURCE_FILE MATCHES ".*(\\.cache|JuceLibraryCode|submodules|_deps).*|.*\\.mm?$")
        cmake_language(EXIT 0)
    endif()

    execute_process(
        COMMAND ${CPPCHECK_COMMAND}
            --template=${CPPCHECK_TEMPLATE}
            --quiet
            --enable=style
            --inline-suppr
            --suppress=internalAstError
            --suppress=preprocessorErrorDirective
            --suppress=unknownMacro
            --suppress=unmatchedSuppression
            --inconclusive
            --error-exitcode=2
            ${FORWARDED_ARGS}
        RESULT_VARIABLE RESULT
    )

    if(NOT RESULT EQUAL 0)
        message(FATAL_ERROR "cppcheck failed with exit code ${RESULT}")
    endif()
endif()
