from datetime import datetime, timezone, timedelta
import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["https://menu2.highhopesma.com", "http://localhost:5173"])

SESSION_TIMEOUT_MINUTES = int(os.getenv("SESSION_TIMEOUT_MINUTES", 15))

# In-memory session store: sessionId -> { updatedAt: datetime, selections: dict }
sessions: dict = {}


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
    }
    return "", 200


@app.route("/api/session/<session_id>", methods=["DELETE"])
def delete_session(session_id):
    sessions.pop(session_id, None)
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
                }
            )
    result.sort(key=lambda x: x["updatedAt"])
    return jsonify(result)


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
