#include <VAR_PROJECT_ID/gui/Window.h>

#include <juce_gui_basics/juce_gui_basics.h>

class Application : public juce::JUCEApplication
{
public:
    const juce::String getApplicationName() override
    {
        return PROJECT_NAME_STRING;
    }

    const juce::String getApplicationVersion() override
    {
        return PROJECT_VERSION_STRING;
    }

    void initialise(const juce::String& commandLine) override
    {
        juce::ignoreUnused(commandLine);
        window = std::make_unique<Window>(getApplicationName());
    }

    void shutdown() override
    {
        window = nullptr;
    }

private:
    std::unique_ptr<Window> window;
};

START_JUCE_APPLICATION(Application)
