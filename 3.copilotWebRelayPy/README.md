# Copilot Web Relay (Python)

GitHub Copilot SDK (Python) を使ったブラウザ動作の AI チャット Web アプリケーション。

## 構成

```
3.copilotWebRelayPy/
├── package.json          # concurrently で同時起動
├── README.md
├── backend/              # Python + Flask + flask-sock + github-copilot-sdk
│   ├── requirements.txt
│   ├── app.py
│   └── .env.example
└── frontend/             # React + TypeScript + Vite (ポート 5174)
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx        # バックエンドポート 5000 に接続
        ├── App.css
        └── components/
            ├── ChatMessage.tsx
            └── ChatInput.tsx
```

## セットアップ

```bash
cd 3.copilotWebRelayPy

# Python 依存パッケージ
pip install -r backend/requirements.txt

# フロントエンド依存パッケージ
npm run install:frontend
```

## 起動

```bash
npm run dev
```

- バックエンド: http://localhost:5000 (Flask + WebSocket)
- フロントエンド: http://localhost:5174

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| バックエンド | Python + Flask + flask-sock + github-copilot-sdk |
| フロントエンド | React 18 + TypeScript + Vite |
| Markdown | react-markdown + remark-gfm |

## WebSocket プロトコル

| 方向 | メッセージ形式 |
|------|----------------|
| クライアント → サーバー | `{ "type": "message", "content": "..." }` |
| サーバー → クライアント (ストリーミング) | `{ "type": "delta", "content": "..." }` |
| サーバー → クライアント (完了) | `{ "type": "done" }` |
| サーバー → クライアント (エラー) | `{ "type": "error", "message": "..." }` |

## 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `COPILOT_MODEL` | `gpt-5.4` | 使用するモデル |
