#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

class Window : public juce::DocumentWindow
{
public:
    explicit Window(juce::StringRef name)
        : juce::DocumentWindow{
            name,
            juce::Desktop::getInstance()
                .getDefaultLookAndFeel()
                .findColour(juce::ResizableWindow::backgroundColourId),
            juce::DocumentWindow::TitleBarButtons::allButtons,
        }
    {
        setUsingNativeTitleBar(true);
        setResizable(true, true);
        setVisible(true);
    }

    void closeButtonPressed() override
    {
        juce::JUCEApplicationBase::quit();
    }

private:
};
