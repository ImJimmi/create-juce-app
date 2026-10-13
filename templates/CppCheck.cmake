include_guard()

find_program(CPPCHECK_COMMAND cppcheck)

if(NOT CPPCHECK_COMMAND)
    if (APPLE)
        message(FATAL_ERROR "cppcheck not found. Install using\n  $ brew install cppcheck")
    elseif (WIN32)
        message(FATAL_ERROR "cppcheck not found. Install using\n  $ choco install cppcheck")
    endif()
endif()

function(add_cppcheck TARGET)
    if (CMAKE_GENERATOR MATCHES ".*Visual Studio.*")
      set(CPPCHECK_TEMPLATE "vs")
    else()
      set(CPPCHECK_TEMPLATE "gcc")
    endif()

    set(CPPCHECK_PROPERTIES
        "${CMAKE_COMMAND}"
        "-DCPPCHECK_COMMAND=${CPPCHECK_COMMAND}"
        "-DCPPCHECK_TEMPLATE=${CPPCHECK_TEMPLATE}"
        -P
        "${PROJECT_SOURCE_DIR}/cmake/RunCppCheck.cmake"
        --
    )

    set_target_properties(${TARGET}
    PROPERTIES
        CXX_CPPCHECK "${CPPCHECK_PROPERTIES}"
    )
endfunction()
