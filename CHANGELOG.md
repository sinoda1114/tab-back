# 変更履歴 / Changelog

このプロジェクトの主な変更点を記録します。
書式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠し、バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

## [0.2.2] - 2026-05-31

### Added

- 選択中（ハイライト中）のタブ URL をまとめてクリップボードへコピーするコマンド `02-copy-selected-tab-urls`
- ピン留めタブの 1〜8 番目へジャンプするコマンド `focus-pinned-1` 〜 `focus-pinned-8`
- Service Worker をスリープから守るためのキープアライブアラーム
- 動作確認用のデバッグログ（`DEBUG` フラグで制御）

### Changed

- コマンド ID に並び順用の数字プレフィックスを付与し、設定画面での並びを安定化
  - `toggle-previous-tab` → `01-toggle-previous-tab`
  - `go-back-tab-history` → `00-go-back-tab-history`
- 既定ショートカットに macOS 用キー（`MacCtrl+Q` / `MacCtrl+Shift+Q`）を追加
- コマンド説明とアクションタイトルを日本語化
- マニフェストの `description` を日本語の説明文に更新

### Security

- `permissions` に `alarms` と `scripting` を追加
- `host_permissions` に `<all_urls>` を追加（クリップボードコピー時にアクティブタブへスクリプトを注入するため）

## [0.1.2] - 2026-05-12

### Changed

- 拡張機能名を `Tab History Back`（短縮名 `Tab Back`）に統一

## [0.1.1] - 2026-05-11

### Added

- README に日本語セクションを追加

## [0.1.0] - 2026-05-11

### Added

- 初回リリース
- `Ctrl+Q`: 現在のタブと直前のタブを切り替え
- `Ctrl+Shift+Q`: タブの利用履歴を 1 つ前に戻る
- 履歴は `chrome.storage.session` に `tabId` / `windowId` のみを保存

[Unreleased]: https://github.com/sinoda1114/tab-back/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/sinoda1114/tab-back/compare/v0.1.2...v0.2.2
[0.1.2]: https://github.com/sinoda1114/tab-back/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/sinoda1114/tab-back/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/sinoda1114/tab-back/releases/tag/v0.1.0
