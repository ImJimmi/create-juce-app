#pragma once

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

    void prepareToPlay(double, int) override
    {
    }

    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override
    {
    }

    void releaseResources() override
    {
    }

    juce::AudioProcessorEditor* createEditor() override
    {
        return new Editor{ *this };
    }

    bool hasEditor() const override
    {
        return true;
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

    //==============================================================================
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

    //==============================================================================
    void getStateInformation(juce::MemoryBlock&) override
    {
    }

    void setStateInformation(const void*, int) override
    {
    }

private:
};
