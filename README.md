# Tab Back

A small Chrome extension for jumping back through recently used tabs.

It has two tab-navigation shortcuts:

- `Ctrl+Q`: toggle between the current tab and the previously active tab
- `Ctrl+Shift+Q`: walk backward through the recent active-tab history

## Shortcuts

Toggle between the current tab and the previous tab:

```text
Ctrl+Q
```

Move backward through tab activation history:

```text
Ctrl+Shift+Q
```

Pressing it repeatedly walks back through the tabs you recently used:

```text
E -> D -> C -> B -> A
```

Chrome may ask you to confirm or change the shortcut at:

```text
chrome://extensions/shortcuts
```

## Install locally

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder.

## Privacy and Security

This extension is intentionally local and dependency-free.

- No npm packages
- No external scripts
- No network requests
- No content scripts
- No host permissions
- No URL or page-title storage

It only stores recent `tabId` and `windowId` values in `chrome.storage.session` so it can switch back to recently active tabs.
