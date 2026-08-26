#pragma once

#include "Parameters.h"

#include <juce_audio_processors/juce_audio_processors.h>

class MainAudioProcessor
{
public:
    MainAudioProcessor(double initialSampleRate,
                       int initialBlockSize,
                       int initialNumChannels,
                       juce::AudioProcessorValueTreeState& processorState)
        : sampleRate{ initialSampleRate }
        , blockSize{ initialBlockSize }
        , numChannels{ initialNumChannels }
        , apvts{ processorState }
        , outputGain{ OutputGainParameter::getFrom(apvts) }
        , bypass{ BypassParameter::getFrom(apvts) }
    {
    }

    void processBlock(juce::AudioBuffer<float>& buffer)
    {
        if (bypass)
            return;

        buffer.applyGain(juce::Decibels::decibelsToGain<float>(outputGain));
    }

private:
    [[maybe_unused]] const double sampleRate;
    [[maybe_unused]] const int blockSize;
    [[maybe_unused]] const int numChannels;

    juce::AudioProcessorValueTreeState& apvts;
    juce::AudioParameterFloat& outputGain;
    juce::AudioParameterBool& bypass;
};
