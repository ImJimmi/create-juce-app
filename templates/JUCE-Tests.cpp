#include "Tests.h"

JUCE_UNIT_TEST("Basic math")
{
    testCase("Addition", [this] {
        expectEquals(1 + 1, 2);
    });
}
