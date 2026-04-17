"""
Flask + flask-sock による AI チャットバックエンド

アーキテクチャ:
  - flask-sock が WebSocket 接続を担当（gevent 不使用）
  - Copilot SDK の呼び出しは専用 asyncio ループ（バックグラウンドスレッド）で実行
  - スレッドセーフな Queue で Flask スレッドと asyncio を橋渡し
"""

import asyncio
import concurrent.futures
import json
import os
import queue as thread_queue
import threading

from dotenv import load_dotenv
from flask import Flask
from flask_sock import Sock
from copilot import CopilotClient
from copilot.session import PermissionHandler
from copilot.generated.session_events import SessionEventType

load_dotenv()

app = Flask(__name__)
sock = Sock(app)

# ── 専用 asyncio イベントループ（バックグラウンドスレッドで常時起動） ──────────
_loop = asyncio.new_event_loop()
_loop_thread = threading.Thread(target=_loop.run_forever, daemon=True)
_loop_thread.start()


def _run_coro(coro):
    """バックグラウンドの asyncio ループでコルーチンを実行し結果を返す"""
    future = asyncio.run_coroutine_threadsafe(coro, _loop)
    return future.result()


# ── HTTP ヘルスチェック ────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}


# ── WebSocket エンドポイント ───────────────────────────────────────────────────
@sock.route("/")
def chat(ws):
    send_q: thread_queue.Queue = thread_queue.Queue()

    # asyncio ループ内でセッションを生成
    async def create_session():
        client = CopilotClient()
        await client.start()
        model = os.environ.get("COPILOT_MODEL", "gpt-5.4")
        session = await client.create_session(
            model=model,
            streaming=True,
            on_permission_request=PermissionHandler.approve_all,
        )

        def on_event(event) -> None:
            if event.type == SessionEventType.ASSISTANT_MESSAGE_DELTA:
                send_q.put({"type": "delta", "content": event.data.delta_content or ""})
            elif event.type == SessionEventType.SESSION_IDLE:
                send_q.put({"type": "done"})

        session.on(on_event)
        print(f"[Copilot] session ready: {session.session_id}, model={model}", flush=True)
        return client, session

    try:
        client, session = _run_coro(create_session())
    except Exception as exc:
        try:
            ws.send(json.dumps({"type": "error", "message": str(exc)}))
        except Exception:
            pass
        return

    # sender スレッド: send_q → WebSocket
    def sender_worker():
        while True:
            item = send_q.get()
            if item is None:
                break
            try:
                ws.send(json.dumps(item, ensure_ascii=False))
            except Exception:
                break

    sender_thread = threading.Thread(target=sender_worker, daemon=True)
    sender_thread.start()

    # メインループ: WebSocket → Copilot
    try:
        while True:
            raw = ws.receive()
            if raw is None:
                break
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                ws.send(json.dumps({"type": "error", "message": "Invalid JSON"}))
                continue
            if msg.get("type") == "message" and msg.get("content"):
                asyncio.run_coroutine_threadsafe(
                    session.send(msg["content"]), _loop
                )
    finally:
        try:
            _run_coro(session.disconnect())
        except Exception:
            pass
        try:
            _run_coro(client.stop())
        except Exception:
            pass
        send_q.put(None)
        sender_thread.join(timeout=3)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f" * Running on http://0.0.0.0:{port} (flask-sock / threaded)", flush=True)
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)

