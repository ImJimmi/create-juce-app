#pragma once

#include "Parameters.h"

#include <Chorus.h>
#include <Stk.h>
#include <juce_audio_processors/juce_audio_processors.h>

#include <span>
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
        , chorus{ sampleRate * 0.02 }
    {
        stk::Stk::setSampleRate(sampleRate);
        chorus.setModFrequency(0.5);
        chorus.setModDepth(0.3);
        chorus.setEffectMix(0.5);
    }

    void processBlock(juce::AudioBuffer<float>& buffer)
    {
        if (bypass)
            return;

        for (auto channelIndex = 0; channelIndex < buffer.getNumChannels(); channelIndex++)
        {
            const std::span channel{
                buffer.getWritePointer(channelIndex),
                static_cast<std::size_t>(buffer.getNumSamples()),
            };

            for (auto& sample : channel)
            {
                sample = static_cast<float>(chorus.tick(static_cast<stk::StkFloat>(sample),
                                                        static_cast<unsigned int>(channelIndex)));
            }
        }

        buffer.applyGain(juce::Decibels::decibelsToGain<float>(outputGain));
    }

private:
    const double sampleRate;
    [[maybe_unused]] const int blockSize;
    [[maybe_unused]] const int numChannels;

    juce::AudioProcessorValueTreeState& apvts;
    juce::AudioParameterFloat& outputGain;
    juce::AudioParameterBool& bypass;

    stk::Chorus chorus;
};
