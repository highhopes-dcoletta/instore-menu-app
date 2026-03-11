from datetime import datetime, timezone, timedelta
import json
import os
import sqlite3

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["https://menu2.highhopesma.com", "https://menu2-stage.highhopesma.com", "http://localhost:5173"])

SESSION_TIMEOUT_MINUTES = int(os.getenv("SESSION_TIMEOUT_MINUTES", 15))

# In-memory session store: sessionId -> { updatedAt, selections, ready, orderNumber }
sessions: dict = {}

# Order counter: 1–99, wraps around
order_counter: int = 0

DB_PATH = os.path.join(os.path.dirname(__file__), "analytics.db")


def _init_db() -> None:
    with sqlite3.connect(DB_PATH) as con:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              ts TEXT NOT NULL,
              event TEXT NOT NULL,
              session_id TEXT,
              properties TEXT
            )
            """
        )
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS bundles (
              id TEXT PRIMARY KEY,
              label TEXT NOT NULL,
              type TEXT NOT NULL DEFAULT 'quantity',
              grp TEXT,
              display_category TEXT,
              quantity INTEGER,
              bundle_price REAL,
              unit_price REAL,
              schedule_days TEXT,
              schedule_dates TEXT,
              match_criteria TEXT NOT NULL DEFAULT '{}',
              sort_order INTEGER DEFAULT 0,
              enabled INTEGER DEFAULT 1,
              created_at TEXT DEFAULT (datetime('now')),
              updated_at TEXT DEFAULT (datetime('now'))
            )
            """
        )
        con.commit()


_init_db()


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


# ── Bundle CRUD ──────────────────────────────────────────────────────────────

def _bundle_row_to_dict(row):
    return {
        "id": row["id"],
        "label": row["label"],
        "type": row["type"],
        "group": row["grp"],
        "displayCategory": row["display_category"],
        "quantity": row["quantity"],
        "bundlePrice": row["bundle_price"],
        "unitPrice": row["unit_price"],
        "scheduleDays": json.loads(row["schedule_days"]) if row["schedule_days"] else None,
        "scheduleDates": json.loads(row["schedule_dates"]) if row["schedule_dates"] else None,
        "matchCriteria": json.loads(row["match_criteria"]),
        "sortOrder": row["sort_order"],
        "enabled": bool(row["enabled"]),
    }


@app.route("/api/bundles", methods=["GET"])
def list_bundles():
    include_disabled = request.args.get("includeDisabled") == "1"
    with sqlite3.connect(DB_PATH) as con:
        con.row_factory = sqlite3.Row
        if include_disabled:
            rows = con.execute("SELECT * FROM bundles ORDER BY sort_order, id").fetchall()
        else:
            rows = con.execute("SELECT * FROM bundles WHERE enabled = 1 ORDER BY sort_order, id").fetchall()
    return jsonify([_bundle_row_to_dict(r) for r in rows])


@app.route("/api/bundles", methods=["POST"])
def create_bundle():
    data = request.get_json(force=True)
    if not data.get("id") or not data.get("label"):
        return jsonify({"error": "id and label are required"}), 400

    with sqlite3.connect(DB_PATH) as con:
        try:
            con.execute(
                """INSERT INTO bundles (id, label, type, grp, display_category, quantity,
                   bundle_price, unit_price, schedule_days, schedule_dates,
                   match_criteria, sort_order, enabled)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    data["id"],
                    data["label"],
                    data.get("type", "quantity"),
                    data.get("group"),
                    data.get("displayCategory"),
                    data.get("quantity"),
                    data.get("bundlePrice"),
                    data.get("unitPrice"),
                    json.dumps(data["scheduleDays"]) if data.get("scheduleDays") else None,
                    json.dumps(data["scheduleDates"]) if data.get("scheduleDates") else None,
                    json.dumps(data.get("matchCriteria", {})),
                    data.get("sortOrder", 0),
                    1 if data.get("enabled", True) else 0,
                ),
            )
            con.commit()
        except sqlite3.IntegrityError:
            return jsonify({"error": "bundle with this id already exists"}), 409
    return "", 201


@app.route("/api/bundles/<bundle_id>", methods=["PUT"])
def update_bundle(bundle_id):
    data = request.get_json(force=True)
    with sqlite3.connect(DB_PATH) as con:
        result = con.execute(
            """UPDATE bundles SET label=?, type=?, grp=?, display_category=?,
               quantity=?, bundle_price=?, unit_price=?, schedule_days=?,
               schedule_dates=?, match_criteria=?, sort_order=?, enabled=?,
               updated_at=datetime('now')
               WHERE id=?""",
            (
                data.get("label", ""),
                data.get("type", "quantity"),
                data.get("group"),
                data.get("displayCategory"),
                data.get("quantity"),
                data.get("bundlePrice"),
                data.get("unitPrice"),
                json.dumps(data["scheduleDays"]) if data.get("scheduleDays") else None,
                json.dumps(data["scheduleDates"]) if data.get("scheduleDates") else None,
                json.dumps(data.get("matchCriteria", {})),
                data.get("sortOrder", 0),
                1 if data.get("enabled", True) else 0,
                bundle_id,
            ),
        )
        con.commit()
        if result.rowcount == 0:
            return jsonify({"error": "not found"}), 404
    return "", 200


@app.route("/api/bundles/<bundle_id>", methods=["DELETE"])
def delete_bundle(bundle_id):
    with sqlite3.connect(DB_PATH) as con:
        con.execute("DELETE FROM bundles WHERE id = ?", (bundle_id,))
        con.commit()
    return "", 200


@app.route("/api/event", methods=["POST"])
def log_event():
    try:
        data = request.get_json(force=True) or {}
        event = data.get("event")
        if not event or not isinstance(event, str) or not event.strip():
            return jsonify({"error": "event is required"}), 400

        session_id = data.get("sessionId")
        properties = data.get("properties")
        ts = datetime.now(timezone.utc).isoformat()
        props_json = json.dumps(properties) if properties is not None else None

        try:
            with sqlite3.connect(DB_PATH) as con:
                con.execute(
                    "INSERT INTO events (ts, event, session_id, properties) VALUES (?, ?, ?, ?)",
                    (ts, event.strip(), session_id, props_json),
                )
                con.commit()
        except Exception as db_err:
            app.logger.error("analytics DB write failed: %s", db_err)

    except Exception as err:
        app.logger.error("log_event error: %s", err)

    return "", 204


@app.route("/api/analytics", methods=["GET"])
def get_analytics():
    try:
        days = int(request.args.get("days", 30))
    except (ValueError, TypeError):
        days = 30

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    with sqlite3.connect(DB_PATH) as con:
        con.row_factory = sqlite3.Row

        # Total add_to_cart events
        total_adds = con.execute(
            "SELECT COUNT(*) FROM events WHERE event = 'add_to_cart' AND ts >= ?",
            (cutoff,),
        ).fetchone()[0]

        # adds_by_source: group by properties->source
        adds_rows = con.execute(
            "SELECT properties FROM events WHERE event = 'add_to_cart' AND ts >= ?",
            (cutoff,),
        ).fetchall()
        adds_by_source: dict = {}
        for row in adds_rows:
            try:
                props = json.loads(row["properties"]) if row["properties"] else {}
                source = props.get("source", "unknown")
            except Exception:
                source = "unknown"
            adds_by_source[source] = adds_by_source.get(source, 0) + 1

        # submitted_orders + avg_items + avg_value
        submitted_rows = con.execute(
            "SELECT properties FROM events WHERE event = 'order_submitted' AND ts >= ?",
            (cutoff,),
        ).fetchall()
        submitted_orders = len(submitted_rows)
        item_counts = []
        total_values = []
        for row in submitted_rows:
            try:
                props = json.loads(row["properties"]) if row["properties"] else {}
                if "item_count" in props:
                    item_counts.append(float(props["item_count"]))
                if "total_value" in props:
                    total_values.append(float(props["total_value"]))
            except Exception:
                pass
        avg_items_submitted = round(sum(item_counts) / len(item_counts), 1) if item_counts else 0.0
        avg_value_submitted = round(sum(total_values) / len(total_values), 2) if total_values else 0.0

        # abandoned_sessions + avg_items_abandoned
        abandoned_rows = con.execute(
            "SELECT properties FROM events WHERE event = 'session_abandoned' AND ts >= ?",
            (cutoff,),
        ).fetchall()
        abandoned_sessions = len(abandoned_rows)
        abandoned_item_counts = []
        for row in abandoned_rows:
            try:
                props = json.loads(row["properties"]) if row["properties"] else {}
                if "item_count" in props:
                    abandoned_item_counts.append(float(props["item_count"]))
            except Exception:
                pass
        avg_items_abandoned = (
            round(sum(abandoned_item_counts) / len(abandoned_item_counts), 1)
            if abandoned_item_counts
            else 0.0
        )

        # guided_completions
        guided_completions = con.execute(
            "SELECT COUNT(*) FROM events WHERE event = 'guided_view_completed' AND ts >= ?",
            (cutoff,),
        ).fetchone()[0]

        # group_feature_uses
        group_feature_uses = con.execute(
            "SELECT COUNT(*) FROM events WHERE event = 'group_feature_used' AND ts >= ?",
            (cutoff,),
        ).fetchone()[0]

        # top_products: top 10 by add_to_cart count, using product_name + category from properties
        all_add_rows = con.execute(
            "SELECT properties FROM events WHERE event = 'add_to_cart' AND ts >= ?",
            (cutoff,),
        ).fetchall()
        product_counts: dict = {}
        for row in all_add_rows:
            try:
                props = json.loads(row["properties"]) if row["properties"] else {}
                name = props.get("product_name", "Unknown")
                category = props.get("category", "")
                key = (name, category)
                product_counts[key] = product_counts.get(key, 0) + 1
            except Exception:
                pass
        top_products = [
            {"name": k[0], "category": k[1], "adds": v}
            for k, v in sorted(product_counts.items(), key=lambda x: -x[1])[:10]
        ]

        # modal_opens
        modal_opens = con.execute(
            "SELECT COUNT(*) FROM events WHERE event = 'product_modal_opened' AND ts >= ?",
            (cutoff,),
        ).fetchone()[0]

        # guided_view_starts
        guided_starts = con.execute(
            "SELECT COUNT(*) FROM events WHERE event = 'guided_view_started' AND ts >= ?",
            (cutoff,),
        ).fetchone()[0]

        # guided completion rate
        guided_completion_rate = (
            round(guided_completions / guided_starts, 2) if guided_starts else None
        )

        # cart_share_views
        cart_share_views = con.execute(
            "SELECT COUNT(*) FROM events WHERE event = 'cart_share_viewed' AND ts >= ?",
            (cutoff,),
        ).fetchone()[0]

        # api_errors
        api_errors = con.execute(
            "SELECT COUNT(*) FROM events WHERE event = 'api_error' AND ts >= ?",
            (cutoff,),
        ).fetchone()[0]

        # top_filters: most applied filter values
        filter_rows = con.execute(
            "SELECT properties FROM events WHERE event = 'filter_applied' AND ts >= ?",
            (cutoff,),
        ).fetchall()
        filter_counts: dict = {}
        for row in filter_rows:
            try:
                props = json.loads(row["properties"]) if row["properties"] else {}
                key = f"{props.get('filter', '?')}: {props.get('value', '?')}"
                filter_counts[key] = filter_counts.get(key, 0) + 1
            except Exception:
                pass
        top_filters = [
            {"label": k, "count": v}
            for k, v in sorted(filter_counts.items(), key=lambda x: -x[1])[:10]
        ]

        # recent_events: last 20
        recent_rows = con.execute(
            "SELECT ts, event, session_id, properties FROM events ORDER BY id DESC LIMIT 20"
        ).fetchall()
        recent_events = []
        for row in recent_rows:
            try:
                props = json.loads(row["properties"]) if row["properties"] else None
            except Exception:
                props = None
            recent_events.append({
                "ts": row["ts"],
                "event": row["event"],
                "session_id": row["session_id"],
                "properties": props,
            })

    return jsonify({
        "period_days": days,
        "total_adds": total_adds,
        "adds_by_source": adds_by_source,
        "submitted_orders": submitted_orders,
        "avg_items_submitted": avg_items_submitted,
        "avg_value_submitted": avg_value_submitted,
        "abandoned_sessions": abandoned_sessions,
        "avg_items_abandoned": avg_items_abandoned,
        "modal_opens": modal_opens,
        "guided_starts": guided_starts,
        "guided_completions": guided_completions,
        "guided_completion_rate": guided_completion_rate,
        "group_feature_uses": group_feature_uses,
        "cart_share_views": cart_share_views,
        "api_errors": api_errors,
        "top_filters": top_filters,
        "top_products": top_products,
        "recent_events": recent_events,
    })


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
