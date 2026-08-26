#pragma once

#include <VAR_PROJECT_ID/audio/MainAudioProcessor.h>
#include <VAR_PROJECT_ID/audio/Parameters.h>
#include <VAR_PROJECT_ID/editor/Editor.h>

#include <juce_audio_processors/juce_audio_processors.h>

class Processor : public juce::AudioProcessor
{
public:
    Processor()
        : juce::AudioProcessor{
            BusesProperties{}
                .withInput("Input", juce::AudioChannelSet::stereo(), true)
                .withOutput("Output", juce::AudioChannelSet::stereo(), true)
        }
        , apvts{
            *this,
            &undoManager,
            "Parameters",
            makeParameters(),
        }
        , bypass{ BypassParameter::getFrom(apvts) }
    {
    }

    ~Processor() override
    {
    }

    bool isBusesLayoutSupported(const BusesLayout& layouts) const override
    {
        return layouts.getMainOutputChannelSet() == layouts.getMainInputChannelSet()
            && (layouts.getMainInputChannelSet() == juce::AudioChannelSet::mono()
                || layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo());
    }

    void prepareToPlay(double sampleRate, int blockSize) override
    {
        mainAudioProcessor = std::make_unique<MainAudioProcessor>(sampleRate,
                                                                  blockSize,
                                                                  getMainBusNumOutputChannels(),
                                                                  apvts);
    }

    void processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer&) override
    {
        const juce::ScopedNoDenormals noDenormals;

        if (mainAudioProcessor == nullptr)
        {
            jassertfalse;
            return;
        }

        mainAudioProcessor->processBlock(buffer);
    }

    void releaseResources() override
    {
        mainAudioProcessor = nullptr;
    }

    juce::AudioProcessorEditor* createEditor() override
    {
        return new Editor{ *this };
    }

    bool hasEditor() const override
    {
        return true;
    }

    juce::AudioProcessorParameter* getBypassParameter() const override
    {
        return &bypass;
    }

    const juce::String getName() const override
    {
        return PROJECT_NAME_STRING;
    }

    bool acceptsMidi() const override
    {
        return false;
    }

    bool producesMidi() const override
    {
        return false;
    }

    bool isMidiEffect() const override
    {
        return false;
    }

    double getTailLengthSeconds() const override
    {
        return 0.0;
    }

    int getNumPrograms() override
    {
        return 1;
    }

    int getCurrentProgram() override
    {
        return 0;
    }

    void setCurrentProgram(int) override
    {
    }

    const juce::String getProgramName(int) override
    {
        return "";
    }

    void changeProgramName(int, const juce::String&) override
    {
    }

    void getStateInformation(juce::MemoryBlock&) override
    {
    }

    void setStateInformation(const void*, int) override
    {
    }

private:
    juce::UndoManager undoManager;
    juce::AudioProcessorValueTreeState apvts;
    juce::AudioParameterBool& bypass;

    std::unique_ptr<MainAudioProcessor> mainAudioProcessor;
};
