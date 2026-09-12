#pragma once

#include "Parameters.h"

#include <Gamma/Domain.h>
#include <Gamma/Filter.h>
#include <juce_audio_processors/juce_audio_processors.h>

#include <vector>

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
        gam::sampleRate(sampleRate);

        filters.resize(static_cast<std::size_t>(numChannels));

        for (auto& filter : filters)
            filter.set(2000.0f, 5.0f);
    }

    void processBlock(juce::AudioBuffer<float>& buffer)
    {
        if (bypass)
            return;

        const auto numChannelsToProcess = juce::jmin(buffer.getNumChannels(), numChannels);

        for (auto channelIndex = 0; channelIndex < numChannelsToProcess; channelIndex++)
        {
            auto& filter = filters[static_cast<std::size_t>(channelIndex)];

            for (auto i = 0; i < buffer.getNumSamples(); i++)
                buffer.setSample(channelIndex, i, filter(buffer.getSample(channelIndex, i)));
        }

        buffer.applyGain(juce::Decibels::decibelsToGain<float>(outputGain));
    }

private:
    const double sampleRate;
    [[maybe_unused]] const int blockSize;
    const int numChannels;

    juce::AudioProcessorValueTreeState& apvts;
    juce::AudioParameterFloat& outputGain;
    juce::AudioParameterBool& bypass;

    std::vector<gam::Biquad<>> filters;
};
