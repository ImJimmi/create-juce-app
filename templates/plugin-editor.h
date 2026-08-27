#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

class Editor : public juce::AudioProcessorEditor
{
public:
    explicit Editor(juce::AudioProcessor& p)
        : juce::AudioProcessorEditor{ &p }
    {
        setSize(500, 300);
    }

    JUCE_DECLARE_NON_COPYABLE(Editor)
    JUCE_DECLARE_NON_MOVEABLE(Editor)

    ~Editor() override = default;

private:
};
