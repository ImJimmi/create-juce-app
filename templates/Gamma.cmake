include_guard()

VAR_ADD_GAMMA

find_program(MAKE_COMMAND make REQUIRED)
set(GAMMA_LIB ${Gamma_SOURCE_DIR}/build/lib/libGamma.a)

add_custom_command(
    OUTPUT ${GAMMA_LIB}
    COMMAND ${MAKE_COMMAND} NO_AUDIO_IO=1 NO_SOUNDFILE=1
    WORKING_DIRECTORY ${Gamma_SOURCE_DIR}
    DEPENDS ${Gamma_SOURCE_DIR}/Makefile
)

add_library(Gamma STATIC IMPORTED GLOBAL)

set_target_properties(Gamma
PROPERTIES
    IMPORTED_LOCATION "${GAMMA_LIB}"
    INTERFACE_INCLUDE_DIRECTORIES "${Gamma_SOURCE_DIR}"
)

add_custom_target(Gamma-build
    DEPENDS ${GAMMA_LIB}
)

add_dependencies(Gamma Gamma-build)
