<p align="center"><img src="assets/Icon-512x.png" width="150"/></p>
<h1 align="center">VAR_PROJECT_NAME</h1>
<p align="center">This project was generated using <a href="https://github.com/ImJimmi/create-juce-app">create-juce-app</a></p>
<p align="center">
  <img src="https://img.shields.io/badge/CMake-064F8C?logo=cmake&style=for-the-badge"/>
  <img src="https://img.shields.io/badge/c++-00599C?logo=c%2B%2B&style=for-the-badge"/>
  <img src="https://img.shields.io/badge/juce-8DC63F?logo=juce&style=for-the-badge&logoColor=white"/>
  VAR_ADDITIONAL_BADGES
</p>

## Building

VAR_PROJECT_NAME uses the CMake build system. Get started by running

```bash
cmake -B build -G "<Generator>"
```

Replace `<Generator>` with your chosen generator, e.g. Xcode, Ninja, etc. Run `cmake --help` for a list of available generators on your system.

The following options can also be specified with `-D <Option>=<ON|OFF>`:

| Option | Description | Default |
| ------ | ----------- | ------- |
VAR_CPM_SOURCE_CACHE_ROW
| `ENABLE_ADDRESS_SANITIZER` | Enables the address sanitizer to help catch bugs relating to memory addresses | `OFF` |
| `ENABLE_THREAD_SANITIZER` | Enables the thread sanitizer to help catch bugs relating to concurrency | `OFF` |
| `ENABLE_REALTIME_SANITIZER` | Clang only - enables the realtime sanitizer to help catch bugs with realtime limitations | `OFF` |

After CMake is configured, build the project using

```bash
cmake --build build --config <Config>
```

Replace `<Config>` with the build configuration, e.g. `Debug`, or `Release`.

## Testing

All tests are registered with CTest. To run the full suite, run

```bash
ctest --test-dir=build --output-on-failure
```

_If using a multi-config generator, be sure to also specify the build config type with `-C <Config>`._

## Installing & Packaging

To install the built binaries to your local system, run

```bash
cmake --install build --prefix <Destination>
```

Replace `<Destination>` with the root for where you want binaries to be installed. On macOS, this should be `/` to install to system directories.

This project is also configured to work with CPack to build PKG installers on macOS and NSIS installers on Windows. These can be built using

```bash
cd build && cpack .
```

_If using a multi-config generator, be sure to also specify the build config type with `-C <Config>`._
