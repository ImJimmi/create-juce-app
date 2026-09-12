#pragma once

#include "Parameters.h"

#include <juce_dsp/juce_dsp.h>

#include <numbers>

class MainAudioProcessor
{
public:
    MainAudioProcessor(const juce::dsp::ProcessSpec& processSpec,
                       juce::AudioProcessorValueTreeState& processorState)
        : apvts{ processorState }
        , outputGain{ OutputGainParameter::getFrom(apvts) }
        , bypass{ BypassParameter::getFrom(apvts) }
    {
        for (auto i = 0; i < 8; i++)
            synth.addVoice(new Voice{ processSpec }); // NOLINT

        synth.addSound(new Sound{}); // NOLINT
        synth.setCurrentPlaybackSampleRate(processSpec.sampleRate);
    }

    void processBlock(juce::AudioBuffer<float>& audioBuffer, juce::MidiBuffer& midiBuffer)
    {
        synth.renderNextBlock(audioBuffer, midiBuffer, 0, audioBuffer.getNumSamples());

        if (bypass)
            audioBuffer.applyGain(0.0f);
        else
            audioBuffer.applyGain(juce::Decibels::decibelsToGain<float>(outputGain));
    }

private:
    struct Sound : public juce::SynthesiserSound
    {
        bool appliesToNote([[maybe_unused]] int noteNumber) override
        {
            return true;
        }

        bool appliesToChannel([[maybe_unused]] int channel) override
        {
            return true;
        }
    };

    struct Voice : public juce::SynthesiserVoice
    {
        explicit Voice(const juce::dsp::ProcessSpec& processSpec)
            : oscillator{ dspChain.get<0>() }
            , gain{ dspChain.get<1>() }
            , voiceBuffer{
                static_cast<int>(processSpec.numChannels),
                static_cast<int>(processSpec.maximumBlockSize),
            }
        {
            oscillator.initialise([](auto phase) {
                return std::sin(phase);
            });
            gain.setRampDurationSeconds(0.01);
            gain.setGainLinear(0.0f);

            dspChain.prepare(processSpec);
            gain.prepare(processSpec);
        }

        bool canPlaySound(juce::SynthesiserSound* sound) override
        {
            return dynamic_cast<Sound*>(sound) != nullptr;
        }

        void startNote(int noteNumber,
                       float velocity,
                       [[maybe_unused]] juce::SynthesiserSound* sound,
                       int pitchWheel) override
        {
            updateFrequency(pitchWheel, noteNumber);
            gain.setGainLinear(std::sqrt(velocity) * 0.1f);
            lastNote = noteNumber;
        }

        void stopNote([[maybe_unused]] float velocity, bool allowTailOff) override
        {
            gain.setGainLinear(0.0f);
            lastNote = -1;

            if (!allowTailOff)
                clearCurrentNote();
        }

        void pitchWheelMoved(int value) override
        {
            if (lastNote >= 0)
                updateFrequency(value, lastNote);
        }

        void controllerMoved([[maybe_unused]] int controller, [[maybe_unused]] int value) override
        {
        }

        void renderNextBlock(juce::AudioBuffer<float>& synthBuffer, int startSample, int numSamples) override
        {
            jassert(synthBuffer.getNumSamples() <= voiceBuffer.getNumSamples());

            voiceBuffer.clear();

            juce::dsp::AudioBlock<float> block{
                voiceBuffer.getArrayOfWritePointers(),
                static_cast<std::size_t>(voiceBuffer.getNumChannels()),
                static_cast<std::size_t>(startSample),
                static_cast<std::size_t>(numSamples),
            };
            const juce::dsp::ProcessContextReplacing<float> context{ block };
            dspChain.process(context);

            for (auto channel = 0; channel < synthBuffer.getNumChannels(); channel++)
                synthBuffer.addFrom(channel, 0, voiceBuffer, channel, 0, synthBuffer.getNumSamples());
        }

        using juce::SynthesiserVoice::renderNextBlock;

    private:
        void updateFrequency(int pitchWheel, int noteNumber)
        {
            const auto pitchWheelNormalised = juce::jmap(static_cast<float>(pitchWheel), 0.0f, 16383.0f, -2.0f, 2.0f);
            const auto exactNote = static_cast<float>(noteNumber) + pitchWheelNormalised;
            const auto frequency = 440.0f * std::pow(2.0f, (exactNote - 69.0f) / 12.0f);
            oscillator.setFrequency(frequency);
        }

        juce::dsp::ProcessorChain<juce::dsp::Oscillator<float>, juce::dsp::Gain<float>> dspChain;
        juce::dsp::Oscillator<float>& oscillator;
        juce::dsp::Gain<float>& gain;

        juce::AudioBuffer<float> voiceBuffer;

        int lastNote = -1;
    };

    juce::AudioProcessorValueTreeState& apvts;
    juce::AudioParameterFloat& outputGain;
    juce::AudioParameterBool& bypass;

    juce::Synthesiser synth;
};
