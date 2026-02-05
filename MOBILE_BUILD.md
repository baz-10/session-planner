# Mobile Build Guide - Session Planner

This guide covers building and running the Session Planner iOS app using Capacitor.

## Prerequisites

1. **macOS** - Required for iOS development
2. **Xcode 15+** - Download from Mac App Store
3. **CocoaPods** - Install with `sudo gem install cocoapods`
4. **Node.js 18+** - For building the web app

## Project Structure

```
ios/
  App/
    App/                    # Main app code
      Assets.xcassets/      # App icons and splash screen
      Info.plist           # App permissions and configuration
      public/              # Built web assets (auto-synced)
    App.xcworkspace        # Open this in Xcode
    Podfile               # iOS dependencies
```

## Development Workflow

### 1. Build the Web App

```bash
npm run build
```

This creates a static export in the `out/` directory.

### 2. Sync with iOS

```bash
npx cap sync ios
```

This copies web assets to the iOS project and updates native dependencies.

### 3. Open in Xcode

```bash
npx cap open ios
```

Or manually open `ios/App/App.xcworkspace` in Xcode.

## Xcode Configuration

### Signing & Capabilities

1. Select the "App" target in Xcode
2. Go to "Signing & Capabilities"
3. Select your Team from the dropdown
4. Xcode will automatically manage signing

### Required Capabilities

The following capabilities need to be enabled (some may require Apple Developer Program membership):

- **Push Notifications** - For team notifications
- **Background Modes** > Remote notifications - For push notification delivery

### Bundle Identifier

The app uses: `com.sessionplanner.app`

You may need to change this if it's already taken in the App Store.

## Running on Simulator

1. Select a simulator from the device dropdown in Xcode
2. Press Cmd+R or click the Play button

## Running on Device

1. Connect your iOS device via USB
2. Trust your computer on the device if prompted
3. Select your device from the device dropdown
4. Press Cmd+R

Note: Running on a physical device requires an Apple Developer account.

## App Store Submission Requirements

Before submitting to the App Store:

### 1. App Icons

Replace the placeholder icons in:
```
ios/App/App/Assets.xcassets/AppIcon.appiconset/
```

Required: 1024x1024 PNG (no transparency, no rounded corners)

### 2. Splash Screen

The splash screen uses the brand color (#1e3a5f). To customize:
- Edit images in `ios/App/App/Assets.xcassets/Splash.imageset/`
- Update `capacitor.config.ts` for color changes

### 3. Privacy Policy & Terms

Add URLs in App Store Connect for:
- Privacy Policy (required)
- Terms of Service (optional but recommended)

### 4. App Store Screenshots

Prepare screenshots for:
- iPhone 6.7" (1290 x 2796)
- iPhone 6.5" (1284 x 2778)
- iPhone 5.5" (1242 x 2208)
- iPad Pro 12.9" (2048 x 2732)

### 5. App Store Description

Prepare:
- App name (30 characters max)
- Subtitle (30 characters max)
- Description (4000 characters max)
- Keywords (100 characters max)
- What's New text for updates

## Permissions Configured

The app requests the following permissions (already configured in Info.plist):

| Permission | Usage |
|------------|-------|
| Camera | Profile photos and team images |
| Photo Library | Selecting profile photos and team images |
| Push Notifications | Team event notifications and reminders |

## Troubleshooting

### Pod Install Fails

```bash
cd ios/App
pod install --repo-update
```

### Build Errors After Sync

1. Clean build folder: Cmd+Shift+K
2. Delete derived data: Cmd+Option+Shift+K
3. Re-sync: `npx cap sync ios`

### Web Assets Not Updating

Ensure you run both commands:
```bash
npm run build
npx cap sync ios
```

### Signing Issues

1. Ensure you're signed into Xcode with your Apple ID
2. Check that "Automatically manage signing" is enabled
3. Select the correct team

## Quick Commands

```bash
# Full rebuild and open
npm run build && npx cap sync ios && npx cap open ios

# Just sync (if web assets already built)
npx cap sync ios

# Open Xcode
npx cap open ios
```

## Notes

- The app uses static export (`output: 'export'`) for Capacitor compatibility
- API routes are not available in the mobile app - all data comes from Supabase client SDK
- OAuth callbacks require deep linking configuration for production use
- For development, you can test on the iOS Simulator without an Apple Developer account
