#pragma once

#include "Parameters.h"

#include <Gamma/Domain.h>
#include <Gamma/Envelope.h>
#include <Gamma/Oscillator.h>
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
        gam::sampleRate(sampleRate);

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
            level = std::sqrt(velocity) * 0.1f;

            oscillator.phase(0.0f);
            envelope.reset();

            updateFrequency(pitchWheel, noteNumber);

            lastNote = noteNumber;
        }

        void stopNote([[maybe_unused]] float velocity, bool allowTailOff) override
        {
            if (allowTailOff)
            {
                envelope.release();
                return;
            }

            clearCurrentNote();
            lastNote = -1;
        }

        void pitchWheelMoved(int value) override
        {
            if (lastNote >= 0)
                updateFrequency(value, lastNote);
        }

        void controllerMoved([[maybe_unused]] int controller, [[maybe_unused]] int value) override
        {
        }

        void renderNextBlock(juce::AudioBuffer<float>& buffer, int startSample, int numSamples) override
        {
            if (!isVoiceActive())
                return;

            for (auto i = startSample; i < numSamples + startSample; i++)
            {
                const auto sample = oscillator() * envelope() * level;

                for (auto channel = 0; channel < buffer.getNumChannels(); channel++)
                    buffer.addSample(channel, i, sample);

                if (envelope.done())
                {
                    clearCurrentNote();
                    lastNote = -1;
                    return;
                }
            }
        }

        using juce::SynthesiserVoice::renderNextBlock;

    private:
        void updateFrequency(int pitchWheel, int noteNumber)
        {
            const auto pitchWheelNormalised = juce::jmap(static_cast<float>(pitchWheel), 0.0f, 16383.0f, -2.0f, 2.0f);
            const auto exactNote = static_cast<float>(noteNumber) + pitchWheelNormalised;
            const auto frequency = 440.0f * std::pow(2.0f, (exactNote - 69.0f) / 12.0f);

            oscillator.freq(frequency);
        }

        gam::Sine<> oscillator;
        gam::ADSR<> envelope{ 0.01f, 0.1f, 0.7f, 0.2f };

        float level = 0.0f;
        int lastNote = -1;
    };

    const double sampleRate;
    [[maybe_unused]] const int blockSize;
    [[maybe_unused]] const int numChannels;

    juce::AudioProcessorValueTreeState& apvts;
    juce::AudioParameterFloat& outputGain;
    juce::AudioParameterBool& bypass;

    juce::Synthesiser synth;
};
