<p align="center"><img src="templates/Icon-512x.png" width="150"/></p>
<h1 align="center">create-juce-app</h1>
<p align="center">The fastest way to create production-ready JUCE projects with all the trimmings</h1>

## Usage

Install [Node](https://nodejs.org), and run

```bash
npx create-juce-app
```

### Options

- `--dump=<file>` - write the answers given to the prompts to `<file>` as JSON
- `--config=<file>` - read answers from a JSON file, skipping the prompts they answer

Together these allow a project to be recreated without any prompts:

```bash
npx create-juce-app --dump=my-project.json
npx create-juce-app --config=my-project.json
```

## Customisation

The various prompts will allow you customise almost every aspect of your JUCE project, including:

- JUCE version, including the `master` and `develop` branches
- Dependency management ([CPM](https://github.com/cpm-cmake/cpm.cmake), [FetchContent](https://cmake.org/cmake/help/latest/module/FetchContent.html), or submodules)
- Project type (Plugin, Desktop App, or Console App)
- Audio API (basic JUCE API, or the `juce_dsp` module)
- Plugin type (Effect, Synth, or MIDI Effect), MIDI input/output, and (for effects) a specific category such as Dynamics, EQ, Filter, Reverb, etc. - categorising the plugin across all supported formats (VST3, AU, AAX, VST)
- GUI API (JUCE components, web front-end, or [JIVE](https://github.com/ImJimmi/JIVE))
- Testing framework ([Catch2](https://github.com/catchorg/Catch2), [GoogleTest](https://github.com/google/googletest), [doctest](https://github.com/doctest/doctest), [Tiny-BDD](https://github.com/ImJimmi/tiny-bdd), or `juce::UnitTest`)
- Various additional extensions from the open-source community

The generator also adds various defaults to get you started, such as:

- Code formatting with [`clang-format`](https://clang.llvm.org/docs/ClangFormat.html)
- Code linting with [`clang-tidy`](https://clang.llvm.org/extra/clang-tidy/), and [`cppcheck`](https://cppcheck.sourceforge.io/)
- [CTest](https://cmake.org/cmake/help/latest/manual/ctest.1.html) integration for all tests
- [CPack](https://cmake.org/cmake/help/latest/manual/cpack.1.html) integration for building installers
- APVTS integration for plugins
- ValueTree state management for Desktop apps
- State saving/loading for Desktop apps and Plugins
- CMake options to enable code sanitizers
- Recommended compiler and linker options
- Placeholder assets for installers' copy and icons, including an Icon Composer bundle for macOS

## Contributing

All contributions are welcome - especially if you'd like to add integration for your own open-source extension.

The project uses a single source file, [`index.js`](./index.js), for ease-of-development, and the [`templates/`](./templates/) directory contains all the template source files and assets.
