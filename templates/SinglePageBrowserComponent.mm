#include "SinglePageBrowserComponent.h"

#import <AppKit/AppKit.h>

void SinglePageBrowserComponent::useSystemTheme()
{
    if (auto* peer = getPeer())
        [static_cast<NSView*>(peer->getNativeHandle()) setAppearance:nil];
}
