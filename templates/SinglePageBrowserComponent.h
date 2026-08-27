#pragma once

#include <juce_gui_extra/juce_gui_extra.h>

#include <ranges>

class SinglePageBrowserComponent : public juce::WebBrowserComponent
{
public:
    static constexpr auto localhost = "http://localhost:3000/";

    SinglePageBrowserComponent()
        : juce::WebBrowserComponent{ getOptions() }
    {
        goToURL(getResourceProviderRoot());
    }

    void parentHierarchyChanged() final
    {
        useSystemTheme();
    }

    bool pageAboutToLoad(const juce::String& newURL) final
    {
        return newURL == localhost || newURL == getResourceProviderRoot();
    }

protected:
    struct ResourceServer
    {
        using ResourceVariant = std::variant<juce::String,
                                             juce::var,
                                             juce::MemoryBlock,
                                             std::vector<std::byte>,
                                             juce::WebBrowserComponent::Resource>;

        const juce::String resourceName;
        const std::function<ResourceVariant()> requestHandler;
    };

    void addResourceServer(ResourceServer&& newServer)
    {
        resourceServers.emplace_back(std::move(newServer));
    }

private:
    [[nodiscard]] static auto& getFrontendApp()
    {
        static const auto currentApplicationFile = juce::File::getSpecialLocation(juce::File::SpecialLocationType::currentApplicationFile);

        static juce::ZipFile zip{
#if JUCE_MAC
            currentApplicationFile
                .getChildFile("Contents")
                .getChildFile("Resources")
                .getChildFile("frontend.zip"),
#else
            currentApplicationFile
                .getParentDirectory()
                .getChildFile("frontend.zip")
#endif
        };

        return zip;
    }

    [[nodiscard]] static auto readVector(juce::InputStream& stream)
    {
        std::vector<std::byte> result(static_cast<size_t>(stream.getTotalLength()));
        stream.setPosition(0);

        [[maybe_unused]] const auto bytesRead = static_cast<std::size_t>(stream.read(std::data(result), std::size(result)));
        jassert(bytesRead == std::size(result));

        return result;
    }

    [[nodiscard]] static auto getMimeTypeForExtension(const juce::String& extension)
    {
        static const std::unordered_map<juce::String, juce::String> mimeMap = {
            { "bin", "application/octet-stream" },
            { "css", "text/css" },
            { "dat", "application/octet-stream" },
            { "htm", "text/html" },
            { "html", "text/html" },
            { "ico", "image/vnd.microsoft.icon" },
            { "jpeg", "image/jpeg" },
            { "jpg", "image/jpeg" },
            { "js", "text/javascript" },
            { "json", "application/json" },
            { "map", "application/json" },
            { "png", "image/png" },
            { "svg", "image/svg+xml" },
            { "txt", "text/plain" },
            { "woff2", "font/woff2" },
        };

        if (const auto mimeType = mimeMap.find(extension.toLowerCase());
            mimeType != std::end(mimeMap))
        {
            return mimeType->second;
        }

        jassertfalse;
        return juce::String{};
    }

    [[nodiscard]] static auto getExtension(const juce::String& filename)
    {
        return filename.fromLastOccurrenceOf(".", false, false).toLowerCase();
    }

    [[nodiscard]] static auto toVector(juce::InputStream& stream)
    {
        std::vector<std::byte> result(static_cast<std::size_t>(stream.getTotalLength()));

        stream.setPosition(0);
        stream.read(std::data(result), std::size(result));

        return result;
    }

    [[nodiscard]] static auto toVector(const juce::String& text)
    {
        juce::MemoryInputStream stream{
            text.getCharPointer(),
            text.getNumBytesAsUTF8(),
            false,
        };

        return toVector(stream);
    }

    [[nodiscard]] static auto getJuceWebBrowserResource(const juce::String& resourceName,
                                                        const ResourceServer::ResourceVariant& resource)
    {
        auto mime = getMimeTypeForExtension(resourceName.fromLastOccurrenceOf(".", false, false));
        const auto data = std::visit([&mime](auto&& value) {
            using T = std::decay_t<decltype(value)>;

            if constexpr (std::is_same<T, juce::String>())
            {
                return toVector(value);
            }
            else if constexpr (std::is_same<T, juce::var>())
            {
                return toVector(juce::JSON::toString(value));
            }
            else if constexpr (std::is_same<T, juce::MemoryBlock>())
            {
                juce::MemoryInputStream stream{
                    value.getData(),
                    value.getSize(),
                    false,
                };
                return toVector(stream);
            }
            else if constexpr (std::is_same<T, std::vector<std::byte>>())
            {
                return value;
            }
            else if constexpr (std::is_same<T, Resource>())
            {
                mime = value.mimeType;
                return value.data;
            }
            else
            {
                jassertfalse;
            }
        },
                                     resource);

        return Resource{ data, mime };
    }

    [[nodiscard]] Resource getResource(const juce::String& requestedURL) const
    {
        const auto url = requestedURL == "/"
                           ? juce::String{ "index.html" }
                           : requestedURL.fromFirstOccurrenceOf("/", false, false);

        auto& frontend = getFrontendApp();

        if (const auto* entry = frontend.getEntry(url))
        {
            const std::unique_ptr<juce::InputStream> stream{
                frontend.createStreamForEntry(*entry),
            };

            return Resource{
                readVector(*stream),
                getMimeTypeForExtension(getExtension(entry->filename)
                                            .toLowerCase()),
            };
        }

        if (const auto resourceServer = std::ranges::find_if(resourceServers,
                                                             [&url](const auto& server) {
                                                                 return server.resourceName == url;
                                                             });
            resourceServer != std::end(resourceServers))
        {
            return getJuceWebBrowserResource(resourceServer->resourceName,
                                             resourceServer->requestHandler());
        }

        return {};
    }

    [[nodiscard]] Options getOptions() const
    {
        return Options{}
            .withBackend(Options::Backend::webview2)
            .withWinWebView2Options(Options::WinWebView2{}
                                        .withUserDataFolder(juce::File::getSpecialLocation(juce::File::SpecialLocationType::tempDirectory)))
            .withNativeIntegrationEnabled()
            .withResourceProvider([this](const auto& url) {
                return getResource(url);
            },
                                  juce::URL{ localhost }.getOrigin());
    }

    void useSystemTheme();

    std::vector<ResourceServer> resourceServers;
};

#if !JUCE_MAC
// Nothing to do on non-macOS systems
// see neighbouring .mm file for macOS implementation
void SinglePageBrowserComponent::useSystemTheme()
{
}
#endif
