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

    JUCE_DECLARE_NON_COPYABLE(Processor)
    JUCE_DECLARE_NON_MOVEABLE(Processor)

    ~Processor() override = default;

    void prepareToPlay(double sampleRate, int blockSize) override
    {
        VAR_PREPARE_TO_PLAY_IMPL
    }

    void processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer&) override
    {
        const juce::ScopedNoDenormals noDenormals;

        if (mainAudioProcessor == nullptr)
        {
            jassertfalse;
            return;
        }

        VAR_PROCESS_BLOCK_IMPL
    }

    void releaseResources() override
    {
        mainAudioProcessor = nullptr;
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
        return PROJECT_NAME;
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

    void getStateInformation(juce::MemoryBlock& memoryBlock) override
    {
        static constexpr auto append = false;
        juce::MemoryOutputStream stream{ memoryBlock, append };
        apvts.copyState().writeToStream(stream);
    }

    void setStateInformation(const void* data, int size) override
    {
        apvts.replaceState(juce::ValueTree::readFromData(data, static_cast<std::size_t>(size)));
    }

protected:
    bool isBusesLayoutSupported(const BusesLayout& layouts) const override
    {
        return layouts.getMainOutputChannelSet() == layouts.getMainInputChannelSet()
            && (layouts.getMainInputChannelSet() == juce::AudioChannelSet::mono()
                || layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo());
    }

private:
    juce::AudioProcessorEditor* createEditor() override
    {
        return new Editor{ *this, apvts }; // NOLINT
    }

    juce::UndoManager undoManager;
    juce::AudioProcessorValueTreeState apvts;
    juce::AudioParameterBool& bypass;

    std::unique_ptr<MainAudioProcessor> mainAudioProcessor;
};
