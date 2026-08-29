#pragma once

#include "SinglePageBrowserComponent.h"

#include <juce_audio_processors/juce_audio_processors.h>

class Editor : public juce::AudioProcessorEditor
{
public:
    Editor(juce::AudioProcessor& p,
           [[maybe_unused]] juce::AudioProcessorValueTreeState& apvts)
        : juce::AudioProcessorEditor{ &p }
    {
        addAndMakeVisible(webview);

        setResizable(true, true);
        setResizeLimits(250, 150, 2500, 1500);
        setSize(500, 300);
    }

    JUCE_DECLARE_NON_COPYABLE(Editor)
    JUCE_DECLARE_NON_MOVEABLE(Editor)

    ~Editor() override = default;

    void paint(juce::Graphics& g) final
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

    void resized() final
    {
        webview.setBounds(getLocalBounds());
    }

private:
    SinglePageBrowserComponent webview;
};
