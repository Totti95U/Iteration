# Issue 38: 破壊的操作の確認 UI を共通コンポーネントへ統一する

Status: Closed (2026-04-18)

## Summary

削除・リセットなどの破壊的操作に対する確認 UI が画面ごとに分散すると、操作感の不一致と保守コスト増加を招く。既存の共通確認ダイアログを基準に、すべての破壊的操作を統一フローへ移行する。これにより誤操作対策の一貫性と実装再利用性を高める。

## Context

Issue 34 で導入した共通確認ダイアログを、破壊的操作の標準フローとして固定化する。今後、報酬・経験値候補・設定変更など破壊的操作が増えるため、`window.confirm` や独自モーダル実装の混在を防ぐルールを維持する。

## Requirements

- 破壊的操作を持つ画面を洗い出し、対象一覧を作る。
- 各画面の削除/リセット導線を共通確認ダイアログに置換する。
- ダイアログの文言方針を定義する。
- タイトルは操作の確認を明示する。
- 説明文は「元に戻せない」性質を明記する。
- ボタン順序は「キャンセル」→「確定」を統一する。
- 新規実装時に `window.confirm` を使わないルールを記載する。

## Current Target Screens

- タスク削除導線（実装済み・共通確認ダイアログ導入済み）
- タスク進捗リセット導線（実装済み・共通確認ダイアログ導入済み）
- 報酬削除導線（未実装）
- 経験値候補の削除導線（未実装）
- 設定系リセット導線（未実装）
- 全データ初期化導線（未実装）

## Implementation Note

- 利用ガイド: `docs/confirm-dialog-guidelines.md`
- Web 側では ESLint の `no-restricted-globals` で `confirm` を禁止する。
- さらに `no-restricted-properties` で `window.confirm` を禁止する。

## Acceptance Criteria Check

- 破壊的操作を持つ対象画面の確認 UI が共通コンポーネント利用に統一されている。
  - 現在実装済みの破壊的操作（タスク削除・進捗リセット）は `ConfirmDialog` を利用。
- どの画面でも確認ダイアログの見た目と操作順序が一致している。
  - `ConfirmDialog` でキャンセル→確定の順序を統一。
- 破壊的操作実装で `window.confirm` が使われていない。
  - `apps/web/src` を確認し、`window.confirm` の使用はなし。
  - ESLint で `confirm` / `window.confirm` を禁止。
- 開発者が参照できる利用ガイドが docs に存在する。
  - `docs/confirm-dialog-guidelines.md` を参照。

## Validation

- `npm run lint:web` を実行し、ルール追加後も通過することを確認する。

## Risks / Open Questions

- 今後導入する破壊的操作（例: 全データ初期化）の権限要件が未確定。
- 文言の最終トーンは UI 全体のトーンガイド整備に合わせて微調整が必要。
