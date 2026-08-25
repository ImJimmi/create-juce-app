include_guard()

# Registers each JUCE_UNIT_TEST() found in the given target's sources as an
# individual CTest test. Tests declared with a category are named
# "<category>.<description>" and labelled with their category.
function(juce_discover_unit_tests target)
    get_target_property(sources ${target} SOURCES)
    get_target_property(target_source_dir ${target} SOURCE_DIR)

    foreach(source IN LISTS sources)
        if(NOT IS_ABSOLUTE "${source}")
            set(source "${target_source_dir}/${source}")
        endif()

        if(NOT EXISTS "${source}")
            continue()
        endif()

        set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS "${source}")
        file(READ "${source}" contents)

        string(REGEX MATCHALL
            "JUCE_UNIT_TEST[ \t\r\n]*\\([ \t\r\n]*\"[^\"]*\"([ \t\r\n]*,[ \t\r\n]*\"[^\"]*\")?[ \t\r\n]*\\)"
            declarations
            "${contents}"
        )

        foreach(declaration IN LISTS declarations)
            string(REGEX MATCH
                "\"([^\"]*)\"([ \t\r\n]*,[ \t\r\n]*\"([^\"]*)\")?"
                matched
                "${declaration}"
            )
            set(description "${CMAKE_MATCH_1}")
            set(category "${CMAKE_MATCH_3}")

            if(category STREQUAL "")
                set(test_name "${description}")
            else()
                set(test_name "${category}.${description}")
            endif()

            add_test(NAME "${test_name}" COMMAND ${target} --name "${description}")

            if(NOT category STREQUAL "")
                set_tests_properties("${test_name}" PROPERTIES LABELS "${category}")
            endif()
        endforeach()
    endforeach()
endfunction()
