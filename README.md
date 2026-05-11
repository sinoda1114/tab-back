# Tab Back

A small Chrome extension for jumping back through recently used tabs.

It has two tab-navigation shortcuts:

- `Ctrl+Q`: toggle between the current tab and the previously active tab
- `Ctrl+Shift+Q`: walk backward through the recent active-tab history

## 日本語

Tab Back は、最近使ったタブへキーボードショートカットで戻るための Chrome 拡張です。

- `Ctrl+Q`: 今のタブと直前に使っていたタブを行き来します
- `Ctrl+Shift+Q`: 最近使ったタブ履歴を古い方向へ順番に戻ります

外部通信や npm 依存はありません。タブの URL やタイトルも保存しません。

### ローカルでの導入

1. Chrome で `chrome://extensions` を開きます。
2. `デベロッパー モード` をオンにします。
3. `パッケージ化されていない拡張機能を読み込む` をクリックします。
4. このフォルダを選択します。

ショートカットは `chrome://extensions/shortcuts` で確認・変更できます。

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
