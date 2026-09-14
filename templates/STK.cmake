include_guard()

VAR_ADD_THE_STK

file(GLOB STK_SOURCES CONFIGURE_DEPENDS ${stk_SOURCE_DIR}/src/*.cpp)
list(FILTER STK_SOURCES EXCLUDE REGEX
    "/(InetWvIn|InetWvOut|Messager|Mutex|RtAudio|RtMidi|RtWvIn|RtWvOut|Socket|TcpClient|TcpServer|Thread|UdpSocket)\\.cpp$"
)

add_library(stk STATIC ${STK_SOURCES})

set_target_properties(stk
PROPERTIES
    POSITION_INDEPENDENT_CODE ON
)

target_include_directories(stk SYSTEM
PUBLIC
    ${stk_SOURCE_DIR}/include
)

target_compile_definitions(stk
PUBLIC
    _USE_MATH_DEFINES
    $<$<STREQUAL:${CMAKE_CXX_BYTE_ORDER},LITTLE_ENDIAN>:__LITTLE_ENDIAN__>
)
