include_guard()

cmake_policy(SET CMP0141 NEW)
set(CMAKE_MSVC_DEBUG_INFORMATION_FORMAT Embedded CACHE STRING "" FORCE)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>" CACHE INTERNAL "")

set_property(GLOBAL PROPERTY USE_FOLDERS YES)
set(JUCE_ENABLE_MODULE_SOURCE_GROUPS ON CACHE STRING "" FORCE)

option(ENABLE_ADDRESS_SANITIZER "" OFF)
if (ENABLE_ADDRESS_SANITIZER)
    add_compile_options(
        $<$<CXX_COMPILER_ID:AppleClang,Clang,GNU>:-fsanitize=address,undefined>
        $<$<CXX_COMPILER_ID:MSVC>:/fsanitizer=address>
    )
    add_link_options(
        $<$<CXX_COMPILER_ID:AppleClang,Clang,GNU>:-fsanitize=address>
    )
endif ()

option(ENABLE_THREAD_SANITIZER "" OFF)
if (ENABLE_THREAD_SANITIZER)
    add_compile_options(
        $<$<CXX_COMPILER_ID:AppleClang,Clang,GNU>:-fsanitize=thread>
    )
    add_link_options(
        $<$<CXX_COMPILER_ID:AppleClang,Clang,GNU>:-fsanitize=thread>
    )
endif ()

option(ENABLE_REALTIME_SANITIZER "" OFF)
if (ENABLE_REALTIME_SANITIZER)
    if (CMAKE_CXX_COMPILER_ID MATCHES "Clang")
        add_compile_options(
            -fsanitize=realtime
        )
        add_link_options(
            -fsanitize=realtime
        )

        get_filename_component(_llvm_root "${CMAKE_CXX_COMPILER}" DIRECTORY)
        get_filename_component(_llvm_root "${_llvm_root}" DIRECTORY)

        if (EXISTS "${_llvm_root}/lib/c++")
            add_link_options(
                -L${_llvm_root}/lib/c++
                -Wl,-rpath,${_llvm_root}/lib/c++
            )
        endif ()
        if (EXISTS "${_llvm_root}/lib/unwind")
            add_link_options(
                -L${_llvm_root}/lib/unwind
                -lunwind
                -Wl,-rpath,${_llvm_root}/lib/unwind
            )
        endif ()
    endif()
endif ()

if (ENABLE_ADDRESS_SANITIZER OR ENABLE_THREAD_SANITIZER OR ENABLE_REALTIME_SANITIZER)
    add_link_options(
        $<$<CXX_COMPILER_ID:AppleClang,Clang,GNU>:-fno-omit-frame-pointer>
        $<$<CXX_COMPILER_ID:AppleClang,Clang,GNU>:-g>
    )
endif()
