# Pomodoro Timer Webアプリケーション アーキテクチャ案

## 1. 目的と前提

本ドキュメントは、Flask + HTML/CSS/JavaScriptで実装するポモドーロタイマーWebアプリのアーキテクチャ方針を定義する。

前提:
- まずはシンプルに動くMVPを短期間で構築する。
- 将来的な機能追加(統計表示、履歴保存、ユーザー管理)に備えて拡張可能な構造にする。
- ユニットテストしやすさを重視し、ロジックと副作用を分離する。

## 2. 全体方針

- Flaskは画面配信とAPI提供を担当する(薄いバックエンド)。
- タイマーの主制御はフロントエンドで実施する。
- 状態は初期段階ではブラウザ側(localStorage)を中心に管理する。
- サーバー状態を持たない構成を基本とし、必要時に永続化層を拡張する。

## 3. レイヤー構成

### 3.1 フロントエンド

1. Presentation層
- HTML/CSSでUIを定義。
- DOMイベントを受け取り、Application層を呼び出す。
- 画面更新は `render()` に集約し、描画ロジックの分散を防ぐ。

2. Application層
- ユースケース(開始/停止/再開/リセット/モード切替/tick処理)を提供。
- Domain層を呼び、Infrastructure層のI/Oをオーケストレーションする。

3. Domain層
- タイマー状態遷移と時間計算の純粋関数を提供。
- 副作用を持たず、入力と出力のみで振る舞いを定義。
- 例: `computeRemaining`, `transitionMode`, `validateSettings`, `canNotify`

4. Infrastructure層
- localStorageアクセス、通知API、音再生、Flask API通信を実装。
- それぞれインターフェース経由で差し替え可能にする。

### 3.2 バックエンド(Flask)

1. Controller層(Flask routes)
- HTTP入出力の変換とレスポンス生成のみを担当。
- ビジネスロジックはService層へ委譲。

2. Service層
- 設定の検証、保存、取得などアプリ固有の処理を担当。

3. Repository層(将来拡張)
- 初期はファイル/メモリ/未実装でもよい。
- 将来SQLiteなどへ差し替え可能な形で抽象化する。

## 4. 状態モデル

クライアントで保持する代表状態:
- `timerState`: `idle | running | paused | completed`
- `mode`: `focus | shortBreak | longBreak`
- `remainingSeconds`
- `endAt` (UNIX時刻)
- `cycleCount`
- `settings`
  - `focusMinutes`
  - `shortBreakMinutes`
  - `longBreakMinutes`
  - `longBreakInterval`
  - `autoStartBreak`
  - `autoStartFocus`

重要方針:
- 毎秒デクリメントではなく、`endAt - now` で残り時間を算出する。
- タブ非アクティブ時や復帰後でも時間の整合性を保ちやすい。

## 5. 依存性注入(DI)方針

テスト容易性のため、以下は直接呼び出さずポート経由で利用する。

- Clockポート
  - `now(): number`
  - 本番: `Date.now()`
  - テスト: 固定時刻/任意時刻を返すFake実装

- Storageポート
  - `get(key)`, `set(key, value)`
  - 本番: localStorage
  - テスト: in-memory storage

- Notifierポート
  - `notifySessionComplete()`
  - 本番: Notification API + 音再生
  - テスト: 呼び出し回数検証可能なMock

- SettingsRepositoryポート
  - `load()`, `save(settings)`
  - 本番: Flask API経由
  - テスト: スタブ/モック実装

## 6. API設計(初期)

MVP時点での最小API:
- `GET /api/health`
- `GET /api/settings`
- `POST /api/settings`

将来拡張API:
- `POST /api/sessions` (完了セッション保存)
- `GET /api/stats` (日次/週次集計)

設計原則:
- Flask routeは薄く、入力検証と変換だけを担当。
- 共通バリデーションは関数化し、再利用可能にする。

## 7. 推奨ディレクトリ構成

```text
1.pomodoro/
  app.py
  templates/
    index.html
  static/
    css/
      style.css
    js/
      presentation/
        ui.js
      application/
        timerUsecases.js
      domain/
        timerDomain.js
        settingsDomain.js
      infrastructure/
        clock.js
        storage.js
        notifier.js
        settingsRepository.js
      main.js
```

補足:
- ファイル名は例。責務分離を優先し、命名は実装時に最終決定する。

## 8. テスト戦略

### 8.1 フロントエンド

1. Domain単体テスト(最優先)
- 時間計算
- 状態遷移
- 設定バリデーション

2. Application単体テスト
- ユースケース実行時の状態変化
- Infrastructureポート呼び出し検証

3. Presentationテスト(最小)
- 主要イベントが正しいユースケースを呼ぶこと
- 主要表示の更新確認

4. E2E(少数)
- 開始 -> 完了 -> モード遷移
- リロード時の状態復元

### 8.2 バックエンド

1. Service単体テスト
- 設定検証
- 保存・取得ロジック

2. Flask routeテスト
- 正常系/異常系レスポンス
- 入力エラー時のステータス/メッセージ

## 9. 重点テストケース

- タブ復帰後も残り時間が正しい。
- `pause -> resume` で時間がずれない。
- セッション完了通知が多重発火しない。
- 境界値(0/負数/上限超過)で設定が正しく弾かれる。
- API失敗時に安全なフォールバックが動作する。

## 10. 非機能要件メモ

- モバイル/デスクトップ双方でUI崩れがないレスポンシブ対応。
- 初期表示と操作レスポンスを軽く保つ。
- アラーム音・通知はユーザー許可状態を考慮。
- 将来の統計追加に備え、セッションデータ構造を早めに規定。

## 11. 今後の実装ステップ

1. UIモック準拠の静的画面を作成。
2. Domain層の純粋関数と単体テストを先に作成。
3. Application層でユースケースを実装。
4. Infrastructure層(localStorage, clock, notifier)を接続。
5. Flask API(settings)を実装してフロントと接続。
6. 最小E2Eを追加して回帰を抑止。

---

この設計により、初期は軽量に実装しつつ、ユニットテスト中心で品質を維持しながら拡張できる構成を目指す。
