# 習慣化バトルパス 技術スタック検討

## 1. 前提条件

- Web アプリ（ブラウザベース）
- 複数端末対応
- 外部認証（Google など）
- サーバー側でのデータ保存
- モバイル対応必須
- リアルタイム同期

## 2. フロントエンド

### 候補 1: Next.js 13+ (TypeScript)

**長所**
- React ベースで学習曲線が緩い。
- API Routes でバックエンドも同時に構築できる。
- ファイルベースルーティングで画面遷移が直感的。
- SSR / SSG / ISR で柔軟な最適化が可能。
- デプロイ先が豊富（Vercel 等）。

**短所**
- セットアップがやや複雑。
- バックエンド機能が限定的（DB 接続はアプリレイヤーで行う必要がある）。
- 初期キャッシュやレンダリング戦略の理解が必要。

### 候補 2: Vite + React + TypeScript

**長所**
- ビルドが高速。
- シンプルな構成で理解しやすい。
- CLI ツールが充実。
- SPA として軽量。

**短所**
- SSR が必要な場合は別途対応が必要。
- バックエンド API は別で用意する必要がある（Next.js より分離が明確）。

### 候補 3: Svelte + Vite

**長所**
- バンドルサイズが小さい。
- リアクティビティが直感的。
- ビルドが高速。

**短所**
- エコシステムが Next.js / React より小さい。
- サードパーティコンポーネント・ライブラリが少ない。
- チーム開発で経験者が探しづらい可能性がある。

**おすすめ：Next.js 13+**（セットアップから運用までが一番安定）

---

## 3. バックエンド

### 候補 1: Node.js + Express または Fastify

**長所**
- JavaScript / TypeScript で統一できる。
- Express は実績が多く、ナレッジが豊富。
- Fastify は高速で最新。
- デプロイ先が豊富。

**短所**
- Node.js は I/O 多重処理が主で、CPU バウンドなタスクには不向き。

### 候補 2: Python + FastAPI

**長所**
- ユーザーが Julia / Python 経験ありで相性がいい。
- FastAPI は近代的で型安全。
- データ処理ライブラリが充実。

**短所**
- Node.js より CPU 消費がやや多い可能性。
- デプロイ手順が Node.js より複雑になりやすい。

### 候補 3: Next.js API Routes / Middleware

**長所**
- フロントエンドと同じリポジトリで管理できる。
- セットアップが最小限。
- 小～中規模なら十分な性能。

**短所**
- バックエンド機能が拡大すると限界を感じやすい。
- マイクロサービス化が難しい。

**おすすめ：Next.js API Routes（MVP なら最小構成で OK）/ Express（拡張性重視）**

---

## 4. データベース

### 候補 1: PostgreSQL

**長所**
- ACID 特性が強い。
- 複雑なクエリに強い。
- ユーザー、タスク、レベル等の複数テーブル管理に向いている。
- オープンソースで運用コスト低い。

**短所**
- 自分でホストする場合はインフラ管理が必要。
- Docker / VPS でのセットアップが必要。

### 候補 2: Firebase Firestore / Realtime Database

**長所**
- サーバーレス、インフラ管理不要。
- リアルタイム同期が標準機能。
- 認証連携が簡単。
- スケーリングが自動。

**短所**
- 価格が使用量に応じて変動（大規模には高くつく可能性）。
- クエリの自由度が限定的。
- ベンダーロックイン。

### 候補 3: Supabase（PostgreSQL + Authentication）

**長stuff**
- PostgreSQL をベースにしつつ、Firebase のような DX を提供。
- リアルタイム機能が充実。
- 認証機能が組み込まれている。
- ベンダーロックインが Firebase より弱い（PostgreSQL ベース）。

**短所**
- 新興サービスなので事例が少なめ。
- 複雑なクエリはやや手間。

**おすすめ：Supabase（バランス最高）/ Firebase（最小セットアップ）**

---

## 5. 認証

### 候補 1: Firebase Authentication

**長所**
- Google / GitHub / メール等の外部認証が簡単に統合できる。
- セッション管理が自動。
- クライアント側での実装が簡潔。

**短所**
- ベンダーロックイン。
- カスタマイズの余地が限定的。

### 候補 2: Auth0

**長所**
- エンタープライズグレードの認証機能。
- 多数の認証プロバイダーに対応。
- SSO 対応。

**短所**
- セットアップが複雑。
- 個人利用では価格が高い可能性。

### 候補 3: NextAuth.js

**長所**
- Next.js と相性が完璧。
- 複数の認証プロバイダーに対応。
- オープンソース。

**短所**
- セッション管理の細かい調整が必要な場合がある。
- 自分でコールバック処理を記述する必要がある。

### 候補 4: Supabase Authentication

**長所**
- Supabase に統合されている。
- Firebase Authentication と同等の使いやすさ。
- PostgreSQL と連携しやすい。

**短所**
- Supabase に依存。

**おすすめ：NextAuth.js ライク（Supabase 選択時）/ Firebase Authentication（Firebase 選択時）**

---

## 6. リアルタイム同期

### 候補 1: Firebase Realtime Database / Firestore リアルタイム機能

**長所**
- 標準機能で変更をリッスンできる。
- セットアップ不要。

**短所**
- Firebase 専用。

### 候補 2: Supabase Realtime

**長所**
- PostgreSQL の変更をリアルタイムに配信。
- 標準機能。

**短所**
- Supabase 専用。

### 候補 3: Polling（定期的な API 呼び出し）

**長所**
- シンプル。
- ライブラリ不要。

**短所**
- レイテンシーが大きい（数秒～十数秒）。
- サーバー負荷増加。

**おすすめ：Supabase Realtime / Firebase Realtime**

---

## 7. UI コンポーネントライブラリ

### 候補 1: shadcn/ui（Radix UI ベース）

**長所**
- デザインがモダン。
- Tailwind CSS ベースでカスタマイズしやすい。
- コンポーネントのコピペ管理なので依存性が低い。

**短所**
- セットアップが初心者向けではない。

### 候補 2: Material-UI (MUI)

**長所**
- コンポーネント数が多い。
- ドキュメントが充実。
- エンタープライズ向け。

**短所**
- Bundle サイズが大きい。
- カスタマイズが複雑。

### 候補 3: Tailwind CSS + 独自コンポーネント

**長所**
- 自由度が高い。
- Bundle サイズが小さい。

**短所**
- コンポーネント実装に時間がかかる。

**おすすめ：shadcn/ui（バランス最高）**

---

## 8. 状態管理

### 候補 1: React Query + zustand

**長所**
- React Query はサーバーステート管理に特化。
- zustand はローカルステートがシンプル。
- 両者の役割分担が明確。

**短所**
- 2 つのライブラリを学ぶ必要がある。

### 候補 2: Redux Toolkit

**長所**
- エンタープライズで実績が豊富。
- デバッグツールが充実。

**短所**
- ボイラープレートが多い。
- 小～中規模なら過剰。

### 候補 3: Jotai / Recoil

**長所**
- アトマイックな状態管理で直感的。
- セットアップが簡潔。

**短所**
- エコシステムが Redux より小さい。

**おすすめ：React Query + zustand**

---

## 9. ホスティング

### 候補 1: Vercel（Next.js 向け）

**長所**
- Next.js に最適化。
- デプロイが最速。
- 無料枠が充実。

**短所**
- API ルートの実行時間に制限がある（最大 10 秒）。

### 候補 2: Railway / Render

**長所**
- PostgreSQL + Node.js を同時にホストできる。
- 価格が安い。
- Vercel より自由度が高い。

**短所**
- セットアップが少し複雑。

### 候補 3: AWS / GCP / Azure

**長所**
- 最高の自由度。
- スケーリングに強い。

**短所**
- セットアップ・運用が複雑。
- 個人で始めるには敷居が高い。

**おすすめ：Vercel（Next.js API Routes 使用時）/ Railway（PostgreSQL + Express）**

---

## 10. ORM / Query Builder

### 候補 1: Prisma

**長所**
- スキーマドリブン開発。
- 型安全。
- マイグレーション管理が優秀。
- ドキュメントが充実。

**短所**
- 学習曲線がやや急。

### 候補 2: TypeORM

**長所**
- Decorator ベースで直感的。
- class-based な設計。

**短所**
- セットアップが複雑。
- パフォーマンスが Prisma より劣る可能性。

### 候補 3: Knex.js

**長所**
- シンプルな Query Builder。
- 低レベルな制御ができる。

**短所**
- 型安全ではない。
- ボイラープレートが多い。

**おすすめ：Prisma**

---

## 11. テスト

### 候補 1: Jest + Testing Library

**長所**
- Jest は設定が簡潔。
- Testing Library はユーザー中心のテスト。
- 実績が豊富。

**短所**
- セットアップがやや複雑。

### 候補 2: Vitest + Playwright

**長所**
- Vitest は Vite ベースで高速。
- Playwright は E2E テストが強い。

**短所**
- 比較的新しい（事例がやや少ない）。

**おすすめ：Jest + Testing Library / Vitest + Playwright**

---

## 推奨スタック（MVP）

| レイヤー | 推奨 | 理由 |
|---------|------|------|
| フロントエンド | Next.js 13+ (TypeScript) | セットアップから運用までワンストップ |
| バックエンド | Next.js API Routes / Express | Routes なら最小構成、拡張なら Express |
| DB | Supabase (PostgreSQL) | リアルタイム同期 + 認証 + インフラ管理なし |
| 認証 | NextAuth.js or Supabase Auth | Next.js と相性抜群 |
| UI | shadcn/ui + Tailwind CSS | モダン + カスタマイズ容易 |
| 状態管理 | React Query + zustand | 役割分担が明確 |
| ORM | Prisma | 型安全 + マイグレーション管理 |
| ホスティング | Vercel | Next.js 最適化 |
| テスト | Jest + Testing Library | 実績豊富 |

---

## 代替スタック（拡張性重視）

| レイヤー | 代替案 | 理由 |
|---------|--------|------|
| フロントエンド | Vite + React + TypeScript | 自由度高い |
| バックエンド | Express + Node.js | マイクロサービス化に対応 |
| DB | PostgreSQL (自ホスト / RDS) | ベンダーロックインなし |
| 認証 | NextAuth.js | オープンソース |
| ホスティング | Railway / Render | 自由度高い |

---

## 初期構築の流れ

1. **フロントエンド基盤** → Next.js + shadcn/ui
2. **認証** → Supabase Auth or NextAuth.js
3. **DB + バックエンド** → Supabase + Prisma
4. **状態管理** → React Query + zustand
5. **ホスティング** → Vercel
6. **テスト** → Jest + Testing Library（段階的に追加）
