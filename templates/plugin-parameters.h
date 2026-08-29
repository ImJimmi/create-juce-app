#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

template <typename ParameterType>
[[nodiscard]] ParameterType& getParameterFrom(const juce::AudioProcessorValueTreeState& apvts,
                                              const juce::ParameterID& id)
{
    auto* param = apvts.getParameter(id.getParamID());
    jassert(param != nullptr);

    return dynamic_cast<ParameterType&>(*param);
}

struct OutputGainParameter
{
    static inline const juce::ParameterID id{ "outGain" };       // NOLINT
    static inline const juce::String name{ "Output Gain (dB)" }; // NOLINT
    static inline const juce::NormalisableRange<float> range{ -12.0f, 12.0f, 0.01f };
    static inline const float defaultValue = 0.0f;
    static constexpr auto stringFromValue = [](float value, int) {
        if (std::abs(value) < 0.005f)
            return juce::String{ "0.00 dB" };

        return juce::String{
            value,
            std::abs(value) < 10.0f ? 2 : 1,
        } + " dB";
    };

    [[nodiscard]] static auto& getFrom(const juce::AudioProcessorValueTreeState& apvts)
    {
        return getParameterFrom<juce::AudioParameterFloat>(apvts, id);
    }
};

struct BypassParameter
{
    static inline const juce::ParameterID id{ "bypass" }; // NOLINT
    static inline const juce::String name{ "Bypass?" };   // NOLINT
    static inline const bool defaultValue = false;

    [[nodiscard]] static auto& getFrom(const juce::AudioProcessorValueTreeState& apvts)
    {
        return getParameterFrom<juce::AudioParameterBool>(apvts, id);
    }
};

[[nodiscard]] inline juce::AudioProcessorValueTreeState::ParameterLayout makeParameters()
{
    return {
        std::make_unique<juce::AudioParameterFloat>(
            OutputGainParameter::id,
            OutputGainParameter::name,
            OutputGainParameter::range,
            OutputGainParameter::defaultValue,
            juce::AudioParameterFloatAttributes{}
                .withStringFromValueFunction(OutputGainParameter::stringFromValue)),

        std::make_unique<juce::AudioParameterBool>(
            BypassParameter::id,
            BypassParameter::name,
            BypassParameter::defaultValue),
    };
}
