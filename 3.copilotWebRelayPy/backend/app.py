import asyncio
import json
import os
from flask import Flask
from flask_sock import Sock
from copilot import CopilotClient
from copilot.session import PermissionHandler
from copilot.generated.session_events import SessionEventType

app = Flask(__name__)
sock = Sock(app)


def send_ws(ws, data: dict):
    """スレッドセーフなWebSocket送信"""
    try:
        ws.send(json.dumps(data, ensure_ascii=False))
    except Exception:
        pass


@sock.route('/')
def chat(ws):
    asyncio.run(_handle_ws(ws))


async def _handle_ws(ws):
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()
    ws_closed = asyncio.Event()

    async def receive_loop():
        """バックグラウンドでWebSocketメッセージを受信"""
        while not ws_closed.is_set():
            try:
                raw = await loop.run_in_executor(None, ws.receive)
                if raw is None:
                    break
                await queue.put(raw)
            except Exception:
                break
        ws_closed.set()
        await queue.put(None)  # センチネル

    receive_task = asyncio.create_task(receive_loop())

    try:
        model = os.environ.get("COPILOT_MODEL", "gpt-5.4")
        async with CopilotClient() as client:
            session = await client.create_session(
                model=model,
                streaming=True,
                on_permission_request=PermissionHandler.approve_all,
            )

            def on_event(event):
                if event.type == SessionEventType.ASSISTANT_MESSAGE_DELTA:
                    send_ws(ws, {"type": "delta", "content": event.data.delta_content or ""})
                elif event.type == SessionEventType.SESSION_IDLE:
                    send_ws(ws, {"type": "done"})

            session.on(on_event)

            print(f"Copilot session ready: {session.session_id}, model={model}")

            while True:
                raw = await queue.get()
                if raw is None:
                    break

                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    send_ws(ws, {"type": "error", "message": "Invalid JSON"})
                    continue

                if msg.get("type") == "message" and msg.get("content"):
                    await session.send(msg["content"])

            await session.disconnect()

    except Exception as e:
        send_ws(ws, {"type": "error", "message": str(e)})
    finally:
        receive_task.cancel()
        try:
            await receive_task
        except asyncio.CancelledError:
            pass


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
