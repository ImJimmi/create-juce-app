#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

class MainComponent
    : public juce::Component
    , private juce::ValueTree::Listener
{
public:
    explicit MainComponent(juce::ValueTree& initialAppState)
        : appState{ initialAppState }
        , counter{ appState, "counter", nullptr }
    {
        title.setText("Hello, World!", juce::dontSendNotification);
        title.setFont(juce::FontOptions{}.withPointHeight(30.0f));
        addAndMakeVisible(title);

        minusButton.setButtonText("-");
        minusButton.setEnabled(*counter > 0);
        minusButton.onClick = [this]() {
            counter = *counter - 1;
        };
        addAndMakeVisible(minusButton);

        counterLabel.setFont(juce::FontOptions{}.withPointHeight(20.0f));
        counterLabel.setJustificationType(juce::Justification::centred);
        counterLabel.getTextValue().referTo(counter.getPropertyAsValue());
        addAndMakeVisible(counterLabel);

        plusButton.setButtonText("+");
        plusButton.onClick = [this]() {
            counter = *counter + 1;
        };
        addAndMakeVisible(plusButton);

        appState.addListener(this);

        setSize(500, 300);
        setWantsKeyboardFocus(true);
    }

    ~MainComponent() override
    {
        appState.removeListener(this);
    }

    void paint(juce::Graphics& g) final
    {
        g.fillAll(findColour(juce::ResizableWindow::backgroundColourId));
    }

    void resized() final
    {
        juce::Grid grid;

        grid.templateRows = { juce::Grid::TrackInfo{}, juce::Grid::TrackInfo{} };
        grid.templateColumns = {
            juce::Grid::Fr{ 1 },
            juce::Grid::TrackInfo{},
            juce::Grid::Fr{ 1 },
        };
        grid.rowGap = juce::Grid::Px{ 20.0f };
        grid.columnGap = juce::Grid::Px{ 10.0f };
        grid.alignItems = juce::Grid::AlignItems::center;
        grid.justifyContent = juce::Grid::JustifyContent::center;
        grid.alignContent = juce::Grid::AlignContent::center;

        grid.items = {
            juce::GridItem{ title }
                .withColumn({ 1, juce::GridItem::Span{ grid.templateColumns.size() } })
                .withJustifySelf(juce::GridItem::JustifySelf::center)
                .withWidth(std::ceil(juce::GlyphArrangement::getStringWidth(title.getFont(), title.getText())))
                .withHeight(std::ceil(title.getFont().getHeight())),
            juce::GridItem{ minusButton }
                .withJustifySelf(juce::GridItem::JustifySelf::end)
                .withWidth(25.0f)
                .withHeight(25.0f),
            juce::GridItem{ counterLabel }
                .withWidth(50.0f)
                .withHeight(std::ceil(counterLabel.getFont().getHeight())),
            juce::GridItem{ plusButton }
                .withJustifySelf(juce::GridItem::JustifySelf::start)
                .withWidth(25.0f)
                .withHeight(25.0f),
        };

        grid.performLayout(getLocalBounds());
    }

private:
    void valueTreePropertyChanged(juce::ValueTree&, const juce::Identifier& name) override
    {
        if (name == counter.getPropertyID())
            minusButton.setEnabled(*counter > 0);
    }

    void updateLayout()
    {
    }

    juce::ValueTree appState;
    juce::Label title;

    juce::TextButton minusButton;
    juce::Label counterLabel;
    juce::TextButton plusButton;
    juce::CachedValue<int> counter;
};
