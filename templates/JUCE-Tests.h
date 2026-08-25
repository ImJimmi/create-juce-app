#pragma once

#include <juce_core/juce_core.h>

class TestRunner : public juce::UnitTestRunner
{
public:
    [[nodiscard]] juce::String getFailureMessage() const
    {
        juce::StringArray failureMessages;

        for (auto i = 0; i < getNumResults(); i++)
        {
            const auto* result = getResult(i);
            jassert(result != nullptr);

            if (result->messages.isEmpty())
                continue;

            if (failureMessages.isEmpty())
                failureMessages.add("  " + result->unitTestName);

            if (!failureMessages.contains("  " + result->unitTestName))
            {
                failureMessages.add("");
                failureMessages.add("  " + result->unitTestName);
            }

            failureMessages.add("    " + result->subcategoryName);

            for (const auto& message : result->messages)
                failureMessages.add("      " + message.fromFirstOccurrenceOf("!!! ", false, false));
        }

        if (!failureMessages.isEmpty())
        {
            juce::String message = "One or more tests failed:";

            for (const auto& failure : failureMessages)
                message << "\n"
                        << failure;

            return message;
        }

        return "";
    }

protected:
    void logMessage(const juce::String& originalMessage) override
    {
        if (previousMessage.endsWith("\r"))
            std::cout << juce::String::repeatedString(" ", previousMessage.length()) << "\r";

        auto newMessage = originalMessage + "\n";

        if (originalMessage.startsWith("Completed tests in")
            || originalMessage.startsWith("!!!")
            || originalMessage.startsWith("FAILED!!")
            || !originalMessage.containsNonWhitespaceChars())
            return;

        if (originalMessage.containsOnly("-"))
            newMessage = " \n";
        else if (originalMessage.startsWith("Starting tests in:"))
            newMessage = originalMessage.replace("Starting tests in: ", "Running: ") + "\r";

        previousMessage = newMessage;

        std::cout << newMessage;
    }

private:
    juce::String previousMessage;
};

#define JUCE_UNIT_TEST_IMPL(TestClass, description, category) \
    namespace                                                 \
    {                                                         \
        struct TestClass : public juce::UnitTest              \
        {                                                     \
            TestClass()                                       \
                : juce::UnitTest{ description, category }     \
            {                                                 \
            }                                                 \
                                                              \
            void runTest() override;                          \
        };                                                    \
                                                              \
        TestClass JUCE_JOIN_MACRO(TestClass, Instance);       \
    }                                                         \
                                                              \
    void TestClass::runTest()

#define JUCE_UNIT_TEST_WITH_CATEGORY(description, category) \
    JUCE_UNIT_TEST_IMPL(JUCE_JOIN_MACRO(JuceUnitTest_, __LINE__), description, category)

#define JUCE_UNIT_TEST_WITHOUT_CATEGORY(description) \
    JUCE_UNIT_TEST_IMPL(JUCE_JOIN_MACRO(JuceUnitTest_, __LINE__), description, "")

#define JUCE_UNIT_TEST_EXPAND(x)                  x
#define JUCE_UNIT_TEST_SELECT(_1, _2, macro, ...) macro

#define JUCE_UNIT_TEST(...)                                 \
    JUCE_UNIT_TEST_EXPAND(                                  \
        JUCE_UNIT_TEST_SELECT(__VA_ARGS__,                  \
                              JUCE_UNIT_TEST_WITH_CATEGORY, \
                              JUCE_UNIT_TEST_WITHOUT_CATEGORY))(__VA_ARGS__)
