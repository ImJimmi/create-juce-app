#include <juce_core/juce_core.h>

#include <iostream>

int main(int argc, char* argv[])
{
    juce::ConsoleApplication app;

    app.addHelpCommand("--help|-h", "Usage:", true);
    app.addVersionCommand("--version|-v", PROJECT_VERSION);

    app.addCommand({ "--greet",
                     "--greet",
                     "Prints a greeting",
                     "Prints a 'Hello, World!' message",
                     [](const auto&) {
                         std::cout << "Hello, World!\n";
                     } });

    return app.findAndRunCommand(argc, argv);
}
