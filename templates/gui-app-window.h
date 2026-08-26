#pragma once

#include "MainComponent.h"

#include <juce_gui_basics/juce_gui_basics.h>

class Window : public juce::DocumentWindow
{
public:
    Window(juce::StringRef name, juce::ValueTree& initialAppState)
        : juce::DocumentWindow{
            name,
            juce::Desktop::getInstance()
                .getDefaultLookAndFeel()
                .findColour(juce::ResizableWindow::backgroundColourId),
            juce::DocumentWindow::TitleBarButtons::allButtons,
        }
        , appState{ initialAppState }
    {
        setContentOwned(new MainComponent{ appState }, true);
        setResizable(true, true);
        setUsingNativeTitleBar(true);

        if (!restoreWindowStateFromString(appState["window-state"].toString()))
            centreWithSize(getWidth(), getHeight());

        setVisible(true);
        initialised = true;
    }

    ~Window() override
    {
    }

    void resized() override
    {
        juce::DocumentWindow::resized();
        updateState();
    }

    void moved() override
    {
        juce::DocumentWindow::moved();
        updateState();
    }

    void closeButtonPressed() override
    {
        juce::JUCEApplicationBase::quit();
    }

private:
    void updateState()
    {
        if (!initialised)
            return;

        appState.setProperty("window-state", getWindowStateAsString(), nullptr);
    }

    juce::ValueTree appState;
    bool initialised = false;
};
