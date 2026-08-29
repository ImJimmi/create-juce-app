#pragma once

#include <VAR_PROJECT_ID/audio/Parameters.h>

#include <juce_audio_processors/juce_audio_processors.h>

class Editor : public juce::AudioProcessorEditor
{
public:
    Editor(juce::AudioProcessor& p,
           juce::AudioProcessorValueTreeState& apvts)
        : juce::AudioProcessorEditor{ &p }
        , gainAttachment{ apvts, OutputGainParameter::id.getParamID(), gainSlider }
        , bypassAttachment{ apvts, BypassParameter::id.getParamID(), bypassButton }
    {
        gainSlider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
        gainSlider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 75, 21);
        gainSlider.textFromValueFunction = [](double value) {
            return OutputGainParameter::stringFromValue(static_cast<float>(value), 0);
        };
        addAndMakeVisible(gainSlider);

        bypassButton.setButtonText("Bypass?");
        addAndMakeVisible(bypassButton);

        setResizable(true, true);
        setResizeLimits(250, 150, 2500, 1500);
        setSize(500, 300);
    }

    JUCE_DECLARE_NON_COPYABLE(Editor)
    JUCE_DECLARE_NON_MOVEABLE(Editor)

    ~Editor() override = default;

    void paint(juce::Graphics& g) final
    {
        g.fillAll(findColour(juce::ResizableWindow::backgroundColourId));
    }

    void resized() final
    {
        juce::FlexBox flex;

        flex.flexDirection = juce::FlexBox::Direction::column;
        flex.alignItems = juce::FlexBox::AlignItems::center;
        flex.justifyContent = juce::FlexBox::JustifyContent::center;

        flex.items = {
            juce::FlexItem{ gainSlider }
                .withWidth(75.0f)
                .withHeight(100.0f)
                .withMargin({ 0.0f, 0.0f, 25.0f, 0.0f }),
            juce::FlexItem{ bypassButton }
                .withWidth(75.0f)
                .withHeight(25.0f),
        };

        flex.performLayout(getLocalBounds());
    }

private:
    juce::Slider gainSlider;
    juce::AudioProcessorValueTreeState::SliderAttachment gainAttachment;

    juce::ToggleButton bypassButton;
    juce::AudioProcessorValueTreeState::ButtonAttachment bypassAttachment;
};
