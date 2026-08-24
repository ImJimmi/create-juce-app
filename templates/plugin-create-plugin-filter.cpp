#include <VAR_PROJECT_ID/Processor.h>

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new Processor{};
}
