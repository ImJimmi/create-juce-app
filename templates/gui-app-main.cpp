#include <VAR_PROJECT_ID/gui/Window.h>

#include <juce_gui_basics/juce_gui_basics.h>

class Application : public juce::JUCEApplication
{
public:
    const juce::String getApplicationName() override
    {
        return PROJECT_NAME;
    }

    const juce::String getApplicationVersion() override
    {
        return PROJECT_VERSION;
    }

    void initialise(const juce::String&) override
    {
        commandManager.registerAllCommandsForTarget(this);
        commandManager.getKeyMappings()->resetToDefaultMappings();

        appState = loadAppState();

        window = std::make_unique<Window>(getApplicationName(), appState);
        window->getContentComponent()->addKeyListener(commandManager.getKeyMappings());
    }

    void shutdown() override
    {
        window = nullptr;
        saveAppState();
    }

    void getCommandInfo(juce::CommandID id, juce::ApplicationCommandInfo& info) override
    {
        if (id == saveCommandID)
        {
            info.commandID = id;
            info.shortName = "Save";
            info.description = "Save the app's current state to the settings file";
            info.categoryName = "Application";
            info.defaultKeypresses = {
                juce::KeyPress{ 's', juce::ModifierKeys::commandModifier, 0 },
            };
            info.flags = juce::ApplicationCommandInfo::readOnlyInKeyEditor;
        }
        else
        {
            juce::JUCEApplication::getCommandInfo(id, info);
        }
    }

    void getAllCommands(juce::Array<juce::CommandID>& commands) override
    {
        juce::JUCEApplication::getAllCommands(commands);
        commands.add(saveCommandID);
    }

    bool perform(const InvocationInfo& invocation) override
    {
        if (invocation.commandID == saveCommandID)
        {
            saveAppState();
            return true;
        }

        return juce::JUCEApplication::perform(invocation);
    }

private:
    enum CommandIDs
    {
        saveCommandID = 0x1337
    };

    [[nodiscard]] juce::ValueTree loadAppState() const
    {
        if (settingsFile.existsAsFile())
        {
            if (auto state = juce::ValueTree::fromXml(settingsFile.loadFileAsString());
                state.isValid())
            {
                DBG("Loaded the app's state from '" << settingsFile.getFullPathName() << "'");
                return state;
            }
        }

        return {
            "AppState",
            {
                { "app-version", PROJECT_VERSION },
                { "counter", 0 },
            },
        };
    }

    void saveAppState() const
    {
        if (!settingsFile.deleteFile())
            jassertfalse;

        if (auto result = settingsFile.create();
            result.failed())
        {
            DBG(result.getErrorMessage());
            jassertfalse;
        }

        auto stream = settingsFile.createOutputStream();
        jassert(stream != nullptr);

        stream->writeText(appState.toXmlString(juce::XmlElement::TextFormat{}),
                          true,
                          true,
                          juce::NewLine::getDefault());

        DBG("Saved the app's state to '" << settingsFile.getFullPathName() << "'");
    }

    static inline const juce::File settingsFile{
        juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
            .getChildFile(juce::String{ PROJECT_NAME }.replace(" ", "_"))
            .getChildFile("settings.xml"),
    };
    juce::ApplicationCommandManager commandManager;
    juce::ValueTree appState;
    std::unique_ptr<Window> window;
};

START_JUCE_APPLICATION(Application)
