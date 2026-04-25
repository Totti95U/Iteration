# Issue 39: Google ログインの連続リロード対策

## 再現手順

1. `npm run dev:web` を実行する。
2. ブラウザで `/login` を開く。
3. 「Google でログイン」を素早く複数回クリックする。
4. `dev:web` のログで `/login` の連続アクセスと panic の有無を確認する。

## 修正内容

- ログイン画面で OAuth 開始処理の多重実行を防ぐため、実行中はボタンを無効化。
- 連打の競合を避けるため、ログイン画面で OAuth 開始処理に即時 `ref` ロックを入れる。
- OAuth コールバックで `code` が無い場合やセッション交換に失敗した場合は、`/login?error=...` に戻して再試行可能にする。
- `next` パラメータは相対パスのみ許可し、意図しない遷移を防ぐ。
- 未ログイン時ホーム画面の `/login` リンクは `prefetch={false}` とし、開発時の不要な先読みアクセスを抑制する。
- `next@16` の Turbopack 開発サーバーで `Next.js package not found` panic が発生したため、通常の `dev` は Webpack モード (`next dev --webpack`) に切り替える。

## 確認手順

1. `npm run dev:web` を実行する。
2. `/login` で「Google でログイン」を1回クリックし、ボタンが遷移中表示になり再クリックできないことを確認する。
3. OAuth 成功時に `/auth/callback` 経由で `/` へ遷移できることを確認する。
4. 同操作を複数回繰り返し、`dev:web` で `/login` の連続アクセススパイクや Turbopack panic が発生しないことを確認する。
5. OAuth 失敗時に `/login` に戻り、エラーメッセージが表示されることを確認する。

## 補足

- Turbopack での再検証が必要な場合は `npm run dev:turbo -w web` を使用する。
- 日常の開発確認では `npm run dev:web` (Webpack) を利用する。
