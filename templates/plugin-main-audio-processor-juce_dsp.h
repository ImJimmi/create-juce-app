#pragma once

#include "Parameters.h"

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_dsp/juce_dsp.h>

class MainAudioProcessor
{
public:
    MainAudioProcessor(const juce::dsp::ProcessSpec& processSpec,
                       juce::AudioProcessorValueTreeState& processorState)
        : spec{ processSpec }
        , apvts{ processorState }
        , outputGain{ OutputGainParameter::getFrom(apvts) }
        , bypass{ BypassParameter::getFrom(apvts) }
    {
        dspChain.prepare(spec);
        dspChain.get<0>().setRampDurationSeconds(0.05);
    }

    template <typename ProcessContext>
    void process(const ProcessContext& context)
    {
        dspChain.get<0>().setGainDecibels(outputGain);

        if (!bypass)
            dspChain.process(context);
    }

private:
    const juce::dsp::ProcessSpec spec;

    juce::AudioProcessorValueTreeState& apvts;
    juce::AudioParameterFloat& outputGain;
    juce::AudioParameterBool& bypass;

    juce::dsp::ProcessorChain<juce::dsp::Gain<float>> dspChain;
};
