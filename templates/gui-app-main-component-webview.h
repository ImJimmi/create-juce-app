#pragma once

#include "SinglePageBrowserComponent.h"

class MainComponent : public SinglePageBrowserComponent
{
public:
    explicit MainComponent(juce::ValueTree& initialAppState)
        : appState{ initialAppState }
    {
        addAndMakeVisible(webview);

        setSize(500, 300);
    }

    void paint(juce::Graphics& g) override
    {
        g.fillAll(findColour(juce::ResizableWindow::backgroundColourId));

#if JUCE_DEBUG
        g.setColour(juce::Colours::white);
        g.setFont(juce::FontOptions{}.withPointHeight(15.0f));
        g.drawText("If you can read this, the webview isn't displaying properly!",
                   getLocalBounds().toFloat(),
                   juce::Justification::centred);
#endif
    }

    void resized() override
    {
        webview.setBounds(getLocalBounds());
    }

private:
    [[maybe_unused]] juce::ValueTree appState;
    SinglePageBrowserComponent webview;
};
