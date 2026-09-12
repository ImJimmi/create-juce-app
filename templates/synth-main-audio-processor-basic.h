#pragma once

#include "Parameters.h"

#include <juce_audio_processors/juce_audio_processors.h>

#include <numbers>

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
        for (auto i = 0; i < 8; i++)
            synth.addVoice(new Voice{}); // NOLINT

        synth.addSound(new Sound()); // NOLINT
        synth.setCurrentPlaybackSampleRate(sampleRate);
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
        bool canPlaySound(juce::SynthesiserSound* sound) override
        {
            return dynamic_cast<Sound*>(sound) != nullptr;
        }

        void startNote(int noteNumber,
                       float velocity,
                       [[maybe_unused]] juce::SynthesiserSound* sound,
                       int pitchWheel) override
        {
            phase = 0.0f;
            level = std::sqrt(velocity) * 0.1f;
            tailOff = 0.0f;

            updateDeltaPhase(pitchWheel, noteNumber);

            lastNote = noteNumber;
        }

        void stopNote([[maybe_unused]] float velocity, bool allowTailOff) override
        {
            if (allowTailOff && juce::approximatelyEqual(tailOff, 0.0f))
            {
                tailOff = 1.0f;
                return;
            }

            clearCurrentNote();
            deltaPhase = 0.0;
            lastNote = -1;
        }

        void pitchWheelMoved(int value) override
        {
            if (lastNote >= 0)
                updateDeltaPhase(value, lastNote);
        }

        void controllerMoved([[maybe_unused]] int controller, [[maybe_unused]] int value) override
        {
        }

        void renderNextBlock(juce::AudioBuffer<float>& buffer, int startSample, int numSamples) override
        {
            if (juce::approximatelyEqual(deltaPhase, 0.0f))
                return;

            // Use the tailOff if it's currently active (>0), otherwise set the
            // gain to 1.0
            static constexpr auto unityGain = 1.0f;
            const auto& gain = tailOff > 0.0f ? tailOff : unityGain;

            for (auto i = startSample; i < numSamples + startSample; i++)
            {
                const auto sample = std::sin(phase) * level * gain;

                for (auto channel = 0; channel < buffer.getNumChannels(); channel++)
                    buffer.addSample(channel, i, sample);

                phase += deltaPhase;
                tailOff *= 0.99f;

                // If the tailOff is not active, this will always be false as
                // gain will be fixed to 1.0.
                if (gain <= 0.005f)
                {
                    clearCurrentNote();

                    deltaPhase = 0.0f;
                    return;
                }
            }
        }

        using juce::SynthesiserVoice::renderNextBlock;

    private:
        void updateDeltaPhase(int pitchWheel, int noteNumber)
        {
            const auto pitchWheelNormalised = juce::jmap(static_cast<float>(pitchWheel), 0.0f, 16383.0f, -2.0f, 2.0f);
            const auto exactNote = static_cast<float>(noteNumber) + pitchWheelNormalised;
            const auto frequency = 440.0f * std::pow(2.0f, (exactNote - 69.0f) / 12.0f);
            deltaPhase = std::numbers::pi_v<float> * 2.0f * frequency / static_cast<float>(getSampleRate());
        }

        float phase = 0.0f;
        float deltaPhase = 0.0f;
        float level = 0.0f;
        float tailOff = 0.0f;

        int lastNote = -1;
    };

    [[maybe_unused]] const double sampleRate;
    [[maybe_unused]] const int blockSize;
    [[maybe_unused]] const int numChannels;

    juce::AudioProcessorValueTreeState& apvts;
    juce::AudioParameterFloat& outputGain;
    juce::AudioParameterBool& bypass;

    juce::Synthesiser synth;
};
