#pragma once

#include "Parameters.h"

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_dsp/juce_dsp.h>

class MainAudioProcessor
{
public:
    MainAudioProcessor(const juce::dsp::ProcessSpec& processSpec,
                       juce::AudioProcessorValueTreeState& processorState)
        : apvts{ processorState }
        , outputGain{ OutputGainParameter::getFrom(apvts) }
        , bypass{ BypassParameter::getFrom(apvts) }
        , gain{ dspChain.get<0>() }
    {
        dspChain.prepare(processSpec);
        gain.setRampDurationSeconds(0.05);
    }

    template <typename ProcessContext>
    void process(const ProcessContext& context)
    {
        gain.setGainDecibels(outputGain);

        if (!bypass)
            dspChain.process(context);
    }

private:
    juce::AudioProcessorValueTreeState& apvts;
    juce::AudioParameterFloat& outputGain;
    juce::AudioParameterBool& bypass;

    juce::dsp::ProcessorChain<juce::dsp::Gain<float>> dspChain;
    juce::dsp::Gain<float>& gain;
};
