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

This validates the Next.js app. The current app uses dynamic routes and API routes,
so `next build` does not create a full static export.

### 2. Sync with iOS

```bash
npm run build:mobile
```

This runs `next build`, prepares the Capacitor `out/` webDir, and runs
`npx cap sync`. If you already built the app and only need to sync native assets,
use:

```bash
npm run cap:sync
```

Direct `npx cap sync` also works after `out/` has been prepared.

### Hosted Next.js App URL

Because the app relies on Next.js API routes and dynamic authenticated pages, the
current native build should point Capacitor at the deployed web app:

```bash
CAPACITOR_SERVER_URL=https://your-session-planner-domain.example npm run build:mobile
```

Without `CAPACITOR_SERVER_URL`, Capacitor syncs a lightweight placeholder shell.
That is useful for native project validation, but it is not the full live app.

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

### `xcodebuild requires Xcode`

If `npm run build:mobile` or `npx cap sync` fails with:

```text
xcode-select: error: tool 'xcodebuild' requires Xcode
```

Install full Xcode, open it once to accept licenses, then select it:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

### Web Assets Not Updating

Ensure you run both commands:
```bash
npm run build
npm run cap:sync
```

### Signing Issues

1. Ensure you're signed into Xcode with your Apple ID
2. Check that "Automatically manage signing" is enabled
3. Select the correct team

## Quick Commands

```bash
# Full rebuild and open
CAPACITOR_SERVER_URL=https://your-session-planner-domain.example npm run build:mobile && npx cap open ios

# Just sync (if web assets already built)
npm run cap:sync

# Open Xcode
npx cap open ios
```

## Notes

- The mobile UI is implemented in reusable components under `src/components/mobile`.
- Primary mobile routes are `/dashboard`, `/dashboard/sessions`, `/dashboard/sessions/[id]`, `/dashboard/sessions/[id]/run`, `/dashboard/events`, `/dashboard/team`, and `/dashboard/more`.

## Known Limitations

- The current native package is a hosted Next.js app wrapper when `CAPACITOR_SERVER_URL` is set.
- A fully bundled offline app would require replacing or proxying API-route dependent features such as Autopilot and billing.
- OAuth callbacks require deep linking configuration for production use
- For development, you can test on the iOS Simulator without an Apple Developer account
