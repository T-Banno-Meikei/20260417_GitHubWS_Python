import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { CopilotClient, approveAll } from "@github/copilot-sdk";
import type { CopilotSession } from "@github/copilot-sdk";

const PORT = 3001;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

interface ClientMessage {
  type: "message";
  content: string;
}

interface ConnectionState {
  client: CopilotClient;
  session: CopilotSession;
  busy: boolean;
}

wss.on("connection", async (ws: WebSocket) => {
  console.log("WebSocket client connected");

  let state: ConnectionState | null = null;
  let cleanedUp = false;

  const send = (data: object) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  };

  // 接続ごとに CopilotClient とセッションを初期化
  try {
    const client = new CopilotClient();
    await client.start();

    const model = process.env.COPILOT_MODEL ?? "gpt-5.4";
    const session = await client.createSession({
      model,
      streaming: true,
      onPermissionRequest: approveAll,
    });

    state = { client, session, busy: false };

    // ストリーミングデルタを転送
    session.on("assistant.message_delta", (event) => {
      send({ type: "delta", content: event.data.deltaContent });
    });

    // セッション完了通知
    session.on("session.idle", () => {
      if (state) state.busy = false;
      send({ type: "done" });
    });

    console.log("Copilot session initialized");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to initialize Copilot session:", message);
    send({ type: "error", message: `セッション初期化失敗: ${message}` });
    ws.close();
    return;
  }

  ws.on("message", async (raw) => {
    if (!state) return;

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      send({ type: "error", message: "無効なJSONメッセージです" });
      return;
    }

    if (parsed.type !== "message" || !parsed.content) {
      send({ type: "error", message: "type='message'とcontentが必要です" });
      return;
    }

    if (state.busy) {
      send({ type: "error", message: "前のメッセージを処理中です" });
      return;
    }

    state.busy = true;
    try {
      await state.session.send({ prompt: parsed.content });
    } catch (err) {
      state.busy = false;
      const message = err instanceof Error ? err.message : String(err);
      console.error("session.send error:", message);
      send({ type: "error", message: `送信エラー: ${message}` });
    }
  });

  const cleanup = async () => {
    if (cleanedUp || !state) return;
    cleanedUp = true;
    console.log("Cleaning up Copilot session...");
    try {
      await state.session.disconnect();
    } catch (err) {
      console.error("session.disconnect error:", err);
    }
    try {
      await state.client.stop();
    } catch (err) {
      console.error("client.stop error:", err);
    }
    state = null;
    console.log("Copilot session cleaned up");
  };

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
    cleanup().catch(console.error);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    cleanup().catch(console.error);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
