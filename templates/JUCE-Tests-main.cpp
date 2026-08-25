#include "Tests.h"

int main(int argc, char* argv[])
{
    static const auto* helpMessage = "Usage:";
    juce::ConsoleApplication app;
    app.addHelpCommand("--help|-h", helpMessage, true);

    const auto printUsage = [&app](const auto& args) {
        std::cout << helpMessage << "\n";
        app.printCommandList(args);
    };

    app.addDefaultCommand({
        "--run-all",
        "--run-all",
        "Runs all the unit tests",
        "Runs all the unit tests",
        [](const auto& args) {
            const auto seed = args.getValueForOption("--seed|-s").getLargeIntValue();
            const auto category = args.getValueForOption("--category|-c");
            const auto name = args.getValueForOption("--name|-n");

            if (category.isNotEmpty() && name.isNotEmpty())
                juce::ConsoleApplication::fail("Can't specify both --category|-c and --name|-n");

            TestRunner runner;
            auto duration = 0.0;

            {
                juce::ScopedTimeMeasurement timer{ duration };

                if (category.isNotEmpty())
                {
                    if (juce::UnitTest::getTestsInCategory(category).size() == 0)
                        juce::ConsoleApplication::fail("No tests in category '" + category + "'");

                    runner.runTestsInCategory(category, seed);
                }
                else if (name.isNotEmpty())
                {
                    if (juce::UnitTest::getTestsWithName(name).size() == 0)
                        juce::ConsoleApplication::fail("No tests named '" + name + "'");

                    runner.runTestsWithName(name, seed);
                }
                else
                {
                    if (juce::UnitTest::getAllTests().size() == 0)
                        juce::ConsoleApplication::fail("No tests to run");

                    runner.runAllTests(seed);
                }
            }

            if (const auto failureMessage = runner.getFailureMessage();
                failureMessage.isNotEmpty())
            {
                juce::ConsoleApplication::fail(failureMessage);
            }
            else
            {
                std::cout << "ALL TESTS PASSED\n";
                std::cout << "Took " << juce::RelativeTime{ duration }.getDescription("0s") << "\n";
            }
        },
    });

    return app.findAndRunCommand(argc, argv);
}
