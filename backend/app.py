from datetime import datetime, timezone, timedelta
import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["https://menu2.highhopesma.com", "http://localhost:5173"])

SESSION_TIMEOUT_MINUTES = int(os.getenv("SESSION_TIMEOUT_MINUTES", 15))

# In-memory session store: sessionId -> { updatedAt, selections, ready, orderNumber }
sessions: dict = {}

# Order counter: 1–99, wraps around
order_counter: int = 0


def _purge_expired() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=SESSION_TIMEOUT_MINUTES)
    expired = [sid for sid, s in sessions.items() if s["updatedAt"] < cutoff]
    for sid in expired:
        del sessions[sid]


@app.route("/api/session", methods=["POST"])
def create_or_update_session():
    data = request.get_json(force=True)
    session_id = data.get("sessionId")
    selections = data.get("selections", {})

    if not session_id:
        return jsonify({"error": "sessionId required"}), 400

    sessions[session_id] = {
        "updatedAt": datetime.now(timezone.utc),
        "selections": selections,
        "ready": False,
        "orderNumber": None,
    }
    return "", 200


@app.route("/api/session/<session_id>", methods=["GET"])
def get_session(session_id):
    s = sessions.get(session_id)
    if not s or not s["selections"]:
        return jsonify({"error": "not found"}), 404
    return jsonify({
        "sessionId": session_id,
        "updatedAt": s["updatedAt"].isoformat(),
        "selections": s["selections"],
        "ready": s.get("ready", False),
        "orderNumber": s.get("orderNumber"),
    })


@app.route("/api/session/<session_id>", methods=["DELETE"])
def delete_session(session_id):
    sessions.pop(session_id, None)
    return "", 200


@app.route("/api/session/<session_id>/submit", methods=["POST"])
def submit_session(session_id):
    global order_counter
    if session_id not in sessions:
        return jsonify({"error": "session not found"}), 404

    order_counter = (order_counter % 99) + 1
    sessions[session_id]["ready"] = True
    sessions[session_id]["orderNumber"] = order_counter
    sessions[session_id]["updatedAt"] = datetime.now(timezone.utc)

    return jsonify({"orderNumber": order_counter})


@app.route("/api/sessions", methods=["DELETE"])
def delete_all_sessions():
    sessions.clear()
    return "", 200


@app.route("/api/sessions", methods=["GET"])
def get_sessions():
    _purge_expired()
    result = []
    for sid, s in sessions.items():
        if s["selections"]:
            result.append(
                {
                    "sessionId": sid,
                    "updatedAt": s["updatedAt"].isoformat(),
                    "selections": s["selections"],
                    "ready": s.get("ready", False),
                    "orderNumber": s.get("orderNumber"),
                }
            )
    # Ready orders first, then by updatedAt
    result.sort(key=lambda x: (not x["ready"], x["updatedAt"]))
    return jsonify(result)


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
