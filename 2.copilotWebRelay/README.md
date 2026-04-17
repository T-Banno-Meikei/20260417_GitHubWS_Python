# Copilot Web Relay

GitHub Copilot SDK を使ったブラウザ動作の AI チャット Web アプリケーション。

## 構成

```
2.copilotWebRelay/
├── package.json          # ルート (concurrently で同時起動)
├── backend/              # Node.js + Express + WebSocket + Copilot SDK
│   ├── package.json
│   ├── tsconfig.json
│   └── src/server.ts
└── frontend/             # React + TypeScript + Vite
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── App.css
        └── components/
            ├── ChatMessage.tsx
            └── ChatInput.tsx
```

## セットアップ

```bash
cd 2.copilotWebRelay
npm run install:all
```

## 起動

```bash
npm run dev
```

- バックエンド: http://localhost:3001
- フロントエンド: http://localhost:5173

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| バックエンド | Node.js + Express + ws + @github/copilot-sdk |
| フロントエンド | React 18 + TypeScript + Vite |
| Markdown | react-markdown + remark-gfm |

## WebSocket プロトコル

| 方向 | メッセージ形式 |
|------|----------------|
| クライアント → サーバー | `{ type: "message", content: "..." }` |
| サーバー → クライアント (ストリーミング) | `{ type: "delta", content: "..." }` |
| サーバー → クライアント (完了) | `{ type: "done" }` |
| サーバー → クライアント (エラー) | `{ type: "error", message: "..." }` |
