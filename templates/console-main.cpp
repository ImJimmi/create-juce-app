#include <juce_core/juce_core.h>

#include <print>

class Logger final : public juce::Logger
{
protected:
    void logMessage(const juce::String& message) override
    {
        std::println("{}", message.toStdString());
    }
};

int main(int argc, char* argv[])
{
    juce::ConsoleApplication app;

    app.addHelpCommand("--help|-h", "Usage:", true);
    app.addVersionCommand("--version|-v", PROJECT_VERSION);

    app.addCommand({
        "--greet",
        "--greet",
        "Prints a greeting",
        "Prints a 'Hello, World!' message",
        [](const auto&) {
            juce::Logger::writeToLog("Hello, World!");
        },
    });

    return app.findAndRunCommand(argc, argv);
}
