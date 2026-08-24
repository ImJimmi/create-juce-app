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

    ~Editor() override
    {
    }

private:
};
