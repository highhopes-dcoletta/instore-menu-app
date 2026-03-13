"""
Flask API tests for highhopes-menu backend.
Run: cd backend && pytest test_app.py -v
"""

import json
import os
import sqlite3
import tempfile

import pytest

# Point at a temp DB so tests never touch the real analytics.db
os.environ.setdefault("SESSION_TIMEOUT_MINUTES", "15")


@pytest.fixture(autouse=True)
def tmp_db(monkeypatch, tmp_path):
    """Redirect every test to a fresh throwaway SQLite database."""
    db = str(tmp_path / "test_analytics.db")
    monkeypatch.setenv("DB_PATH_OVERRIDE", db)
    # Patch the module-level DB_PATH after import
    import app as flask_app
    monkeypatch.setattr(flask_app, "DB_PATH", db)
    flask_app._init_db()
    yield db


@pytest.fixture()
def client(tmp_db):
    import app as flask_app
    flask_app.sessions.clear()
    flask_app.order_counter = 0
    flask_app.app.config["TESTING"] = True
    with flask_app.app.test_client() as c:
        yield c


# ─── /api/session POST ────────────────────────────────────────────────────────

class TestCreateSession:
    def test_creates_session(self, client):
        r = client.post("/api/session", json={"sessionId": "abc", "selections": {"p1": {"name": "OG Kush"}}})
        assert r.status_code == 200

    def test_missing_session_id_returns_400(self, client):
        r = client.post("/api/session", json={"selections": {}})
        assert r.status_code == 400

    def test_updates_existing_session(self, client):
        client.post("/api/session", json={"sessionId": "abc", "selections": {"p1": {"name": "OG Kush"}}})
        client.post("/api/session", json={"sessionId": "abc", "selections": {"p2": {"name": "Blue Dream"}}})
        r = client.get("/api/session/abc")
        assert "p2" in r.get_json()["selections"]
        assert "p1" not in r.get_json()["selections"]


# ─── /api/session/<id> GET ────────────────────────────────────────────────────

class TestGetSession:
    def test_returns_session(self, client):
        client.post("/api/session", json={"sessionId": "s1", "selections": {"p1": {"name": "Flower"}}})
        r = client.get("/api/session/s1")
        assert r.status_code == 200
        data = r.get_json()
        assert data["sessionId"] == "s1"
        assert "p1" in data["selections"]
        assert data["ready"] is False

    def test_not_found_returns_404(self, client):
        r = client.get("/api/session/does-not-exist")
        assert r.status_code == 404

    def test_empty_selections_returns_404(self, client):
        client.post("/api/session", json={"sessionId": "empty", "selections": {}})
        r = client.get("/api/session/empty")
        assert r.status_code == 404


# ─── /api/session/<id> DELETE ────────────────────────────────────────────────

class TestDeleteSession:
    def test_deletes_existing_session(self, client):
        client.post("/api/session", json={"sessionId": "del1", "selections": {"p1": {}}})
        r = client.delete("/api/session/del1")
        assert r.status_code == 200
        assert client.get("/api/session/del1").status_code == 404

    def test_delete_nonexistent_is_ok(self, client):
        r = client.delete("/api/session/ghost")
        assert r.status_code == 200


# ─── /api/session/<id>/submit POST ───────────────────────────────────────────

class TestSubmitSession:
    def test_submit_returns_order_number(self, client):
        client.post("/api/session", json={"sessionId": "sub1", "selections": {"p1": {}}})
        r = client.post("/api/session/sub1/submit")
        assert r.status_code == 200
        data = r.get_json()
        assert "orderNumber" in data
        assert 1 <= data["orderNumber"] <= 99

    def test_submit_marks_ready(self, client):
        client.post("/api/session", json={"sessionId": "sub2", "selections": {"p1": {}}})
        client.post("/api/session/sub2/submit")
        r = client.get("/api/session/sub2")
        assert r.get_json()["ready"] is True

    def test_submit_nonexistent_returns_404(self, client):
        r = client.post("/api/session/ghost/submit")
        assert r.status_code == 404

    def test_order_counter_wraps_at_99(self, client):
        import app as flask_app
        flask_app.order_counter = 99
        client.post("/api/session", json={"sessionId": "wrap", "selections": {"p1": {}}})
        r = client.post("/api/session/wrap/submit")
        assert r.get_json()["orderNumber"] == 1

    def test_sequential_orders_increment(self, client):
        numbers = []
        for i in range(3):
            sid = f"seq{i}"
            client.post("/api/session", json={"sessionId": sid, "selections": {"p1": {}}})
            r = client.post(f"/api/session/{sid}/submit")
            numbers.append(r.get_json()["orderNumber"])
        assert numbers == [1, 2, 3]


# ─── /api/sessions GET ───────────────────────────────────────────────────────

class TestListSessions:
    def test_lists_active_sessions(self, client):
        client.post("/api/session", json={"sessionId": "a", "selections": {"p1": {}}})
        client.post("/api/session", json={"sessionId": "b", "selections": {"p2": {}}})
        r = client.get("/api/sessions")
        ids = [s["sessionId"] for s in r.get_json()]
        assert "a" in ids and "b" in ids

    def test_excludes_empty_selections(self, client):
        client.post("/api/session", json={"sessionId": "empty", "selections": {}})
        r = client.get("/api/sessions")
        ids = [s["sessionId"] for s in r.get_json()]
        assert "empty" not in ids

    def test_ready_orders_appear_first(self, client):
        client.post("/api/session", json={"sessionId": "first", "selections": {"p1": {}}})
        client.post("/api/session", json={"sessionId": "second", "selections": {"p2": {}}})
        client.post("/api/session/second/submit")
        r = client.get("/api/sessions")
        sessions = r.get_json()
        assert sessions[0]["sessionId"] == "second"
        assert sessions[0]["ready"] is True

    def test_purges_expired_sessions(self, client, monkeypatch):
        import app as flask_app
        from datetime import datetime, timezone, timedelta

        client.post("/api/session", json={"sessionId": "old", "selections": {"p1": {}}})
        # Back-date the session so it appears expired
        flask_app.sessions["old"]["updatedAt"] = (
            datetime.now(timezone.utc) - timedelta(minutes=30)
        )
        r = client.get("/api/sessions")
        ids = [s["sessionId"] for s in r.get_json()]
        assert "old" not in ids


# ─── /api/sessions DELETE ────────────────────────────────────────────────────

class TestDeleteAllSessions:
    def test_clears_all_sessions(self, client):
        client.post("/api/session", json={"sessionId": "x", "selections": {"p1": {}}})
        client.delete("/api/sessions")
        assert client.get("/api/sessions").get_json() == []


# ─── /api/event POST ─────────────────────────────────────────────────────────

class TestLogEvent:
    def test_valid_event_returns_204(self, client):
        r = client.post("/api/event", json={"event": "add_to_cart", "properties": {"source": "browse"}})
        assert r.status_code == 204

    def test_missing_event_returns_400(self, client):
        r = client.post("/api/event", json={"properties": {}})
        assert r.status_code == 400

    def test_blank_event_returns_400(self, client):
        r = client.post("/api/event", json={"event": "   "})
        assert r.status_code == 400

    def test_event_written_to_db(self, client, tmp_db):
        client.post("/api/event", json={"event": "test_event", "sessionId": "s1", "properties": {"k": "v"}})
        with sqlite3.connect(tmp_db) as con:
            row = con.execute("SELECT event, session_id, properties FROM events WHERE event='test_event'").fetchone()
        assert row is not None
        assert row[0] == "test_event"
        assert row[1] == "s1"
        assert json.loads(row[2]) == {"k": "v"}

    def test_event_without_session_id_ok(self, client, tmp_db):
        r = client.post("/api/event", json={"event": "page_view"})
        assert r.status_code == 204


# ─── /api/analytics GET ──────────────────────────────────────────────────────

class TestAnalytics:
    def _seed(self, client, event, properties=None, session_id=None):
        client.post("/api/event", json={"event": event, "sessionId": session_id, "properties": properties or {}})

    def test_returns_200_with_empty_db(self, client):
        r = client.get("/api/analytics")
        assert r.status_code == 200
        data = r.get_json()
        assert data["total_adds"] == 0
        assert data["submitted_orders"] == 0

    def test_total_adds_counted(self, client):
        self._seed(client, "add_to_cart", {"source": "browse", "product_name": "OG Kush", "category": "FLOWER"})
        self._seed(client, "add_to_cart", {"source": "modal",  "product_name": "Blue Dream", "category": "FLOWER"})
        data = client.get("/api/analytics").get_json()
        assert data["total_adds"] == 2

    def test_adds_by_source_grouped(self, client):
        self._seed(client, "add_to_cart", {"source": "browse"})
        self._seed(client, "add_to_cart", {"source": "browse"})
        self._seed(client, "add_to_cart", {"source": "modal"})
        data = client.get("/api/analytics").get_json()
        assert data["adds_by_source"]["browse"] == 2
        assert data["adds_by_source"]["modal"] == 1

    def test_submitted_orders_counted(self, client):
        self._seed(client, "order_submitted", {"item_count": 3, "total_value": 45.0})
        self._seed(client, "order_submitted", {"item_count": 1, "total_value": 12.0})
        data = client.get("/api/analytics").get_json()
        assert data["submitted_orders"] == 2
        assert data["avg_items_submitted"] == 2.0

    def test_abandoned_sessions_counted(self, client):
        self._seed(client, "session_abandoned", {"item_count": 2})
        data = client.get("/api/analytics").get_json()
        assert data["abandoned_sessions"] == 1
        assert data["avg_items_abandoned"] == 2.0

    def test_top_products_sorted_by_adds(self, client):
        for _ in range(3):
            self._seed(client, "add_to_cart", {"product_name": "OG Kush", "category": "FLOWER"})
        self._seed(client, "add_to_cart", {"product_name": "Blue Dream", "category": "FLOWER"})
        data = client.get("/api/analytics").get_json()
        assert data["top_products"][0]["name"] == "OG Kush"
        assert data["top_products"][0]["adds"] == 3

    def test_modal_opens_counted(self, client):
        self._seed(client, "product_modal_opened")
        self._seed(client, "product_modal_opened")
        data = client.get("/api/analytics").get_json()
        assert data["modal_opens"] == 2

    def test_guided_completion_rate(self, client):
        self._seed(client, "guided_view_started")
        self._seed(client, "guided_view_started")
        self._seed(client, "guided_view_completed")
        data = client.get("/api/analytics").get_json()
        assert data["guided_starts"] == 2
        assert data["guided_completions"] == 1
        assert data["guided_completion_rate"] == 0.5

    def test_guided_completion_rate_none_when_no_starts(self, client):
        data = client.get("/api/analytics").get_json()
        assert data["guided_completion_rate"] is None

    def test_cart_share_views_counted(self, client):
        self._seed(client, "cart_share_viewed")
        data = client.get("/api/analytics").get_json()
        assert data["cart_share_views"] == 1

    def test_api_errors_counted(self, client):
        self._seed(client, "api_error")
        self._seed(client, "api_error")
        data = client.get("/api/analytics").get_json()
        assert data["api_errors"] == 2

    def test_top_filters_aggregated(self, client):
        self._seed(client, "filter_applied", {"filter": "strain", "value": "INDICA"})
        self._seed(client, "filter_applied", {"filter": "strain", "value": "INDICA"})
        self._seed(client, "filter_applied", {"filter": "brand", "value": "High Hopes"})
        data = client.get("/api/analytics").get_json()
        labels = [f["label"] for f in data["top_filters"]]
        assert "strain: INDICA" in labels
        assert data["top_filters"][0]["label"] == "strain: INDICA"
        assert data["top_filters"][0]["count"] == 2

    def test_period_days_param_respected(self, client, tmp_db):
        # Manually insert an old event outside the 7-day window
        import sqlite3
        with sqlite3.connect(tmp_db) as con:
            con.execute(
                "INSERT INTO events (ts, event, session_id, properties) VALUES (?, ?, ?, ?)",
                ("2020-01-01T00:00:00+00:00", "add_to_cart", None, '{"source":"browse"}'),
            )
        data = client.get("/api/analytics?days=7").get_json()
        assert data["total_adds"] == 0

    def test_period_days_all_time(self, client, tmp_db):
        import sqlite3
        with sqlite3.connect(tmp_db) as con:
            con.execute(
                "INSERT INTO events (ts, event, session_id, properties) VALUES (?, ?, ?, ?)",
                ("2020-01-01T00:00:00+00:00", "add_to_cart", None, '{"source":"browse"}'),
            )
        data = client.get("/api/analytics?days=365").get_json()
        # 2020 is > 365 days ago, won't appear — but tests the param parsing
        assert data["period_days"] == 365


# ─── Journey tracking ──────────────────────────────────────────────────────

class TestJourneyHeartbeat:
    def test_heartbeat_creates_navigate_step(self, client):
        client.post("/api/session/heartbeat", json={"sessionId": "j1", "route": "/flower"})
        import app as flask_app
        journey = flask_app.sessions["j1"]["journey"]
        assert len(journey) == 1
        assert journey[0]["type"] == "navigate"
        assert journey[0]["label"] == "/flower"
        assert "ts" in journey[0]

    def test_heartbeat_deduplicates_same_route(self, client):
        client.post("/api/session/heartbeat", json={"sessionId": "j2", "route": "/flower"})
        client.post("/api/session/heartbeat", json={"sessionId": "j2", "route": "/flower"})
        client.post("/api/session/heartbeat", json={"sessionId": "j2", "route": "/flower"})
        import app as flask_app
        journey = flask_app.sessions["j2"]["journey"]
        assert len(journey) == 1

    def test_heartbeat_appends_on_route_change(self, client):
        client.post("/api/session/heartbeat", json={"sessionId": "j3", "route": "/flower"})
        client.post("/api/session/heartbeat", json={"sessionId": "j3", "route": "/edibles"})
        client.post("/api/session/heartbeat", json={"sessionId": "j3", "route": "/vapes"})
        import app as flask_app
        journey = flask_app.sessions["j3"]["journey"]
        assert len(journey) == 3
        assert [s["label"] for s in journey] == ["/flower", "/edibles", "/vapes"]

    def test_heartbeat_dedup_ignores_non_navigate_steps(self, client):
        """Navigate dedup should only compare against navigate steps, not add/remove steps."""
        client.post("/api/session/heartbeat", json={"sessionId": "j4", "route": "/flower"})
        # Insert a non-navigate step
        client.post("/api/session/journey", json={"sessionId": "j4", "type": "add", "label": "OG Kush +1"})
        # Same route heartbeat should still be deduped
        client.post("/api/session/heartbeat", json={"sessionId": "j4", "route": "/flower"})
        import app as flask_app
        journey = flask_app.sessions["j4"]["journey"]
        nav_steps = [s for s in journey if s["type"] == "navigate"]
        assert len(nav_steps) == 1

    def test_heartbeat_without_route_skips_journey(self, client):
        client.post("/api/session/heartbeat", json={"sessionId": "j5", "route": "/flower"})
        client.post("/api/session/heartbeat", json={"sessionId": "j5"})
        import app as flask_app
        journey = flask_app.sessions["j5"]["journey"]
        assert len(journey) == 1


class TestJourneyEndpoint:
    def test_appends_step(self, client):
        client.post("/api/session", json={"sessionId": "j10", "selections": {"p1": {}}})
        r = client.post("/api/session/journey", json={
            "sessionId": "j10", "type": "add", "label": "OG Kush +1 from list"
        })
        assert r.status_code == 204
        import app as flask_app
        journey = flask_app.sessions["j10"]["journey"]
        assert len(journey) == 1
        assert journey[0] == {"type": "add", "label": "OG Kush +1 from list", "ts": journey[0]["ts"]}

    def test_multiple_steps_accumulate(self, client):
        client.post("/api/session", json={"sessionId": "j11", "selections": {"p1": {}}})
        client.post("/api/session/journey", json={"sessionId": "j11", "type": "add", "label": "A +1"})
        client.post("/api/session/journey", json={"sessionId": "j11", "type": "search", "label": 'Searched "gummy"'})
        client.post("/api/session/journey", json={"sessionId": "j11", "type": "remove", "label": "A -1"})
        import app as flask_app
        journey = flask_app.sessions["j11"]["journey"]
        assert len(journey) == 3
        assert [s["type"] for s in journey] == ["add", "search", "remove"]

    def test_missing_fields_returns_400(self, client):
        assert client.post("/api/session/journey", json={"sessionId": "x"}).status_code == 400
        assert client.post("/api/session/journey", json={"sessionId": "x", "type": "add"}).status_code == 400
        assert client.post("/api/session/journey", json={"type": "add", "label": "foo"}).status_code == 400

    def test_ignores_unknown_session(self, client):
        r = client.post("/api/session/journey", json={
            "sessionId": "ghost", "type": "add", "label": "foo"
        })
        assert r.status_code == 204  # silent no-op


class TestJourneyPreservation:
    def test_cart_sync_preserves_journey(self, client):
        """POST /api/session (cart sync) must not erase existing journey."""
        client.post("/api/session", json={"sessionId": "j20", "selections": {"p1": {}}})
        client.post("/api/session/journey", json={"sessionId": "j20", "type": "add", "label": "A +1"})
        client.post("/api/session/journey", json={"sessionId": "j20", "type": "filter", "label": "Filter: brand"})
        # Cart sync overwrites selections
        client.post("/api/session", json={"sessionId": "j20", "selections": {"p1": {}, "p2": {}}})
        import app as flask_app
        journey = flask_app.sessions["j20"]["journey"]
        assert len(journey) == 2
        assert journey[0]["type"] == "add"

    def test_new_session_starts_with_empty_journey(self, client):
        client.post("/api/session", json={"sessionId": "j21", "selections": {"p1": {}}})
        import app as flask_app
        assert flask_app.sessions["j21"]["journey"] == []


class TestJourneySubmit:
    def test_submit_appends_journey_step(self, client):
        client.post("/api/session", json={"sessionId": "j30", "selections": {"p1": {}}})
        client.post("/api/session/j30/submit")
        import app as flask_app
        journey = flask_app.sessions["j30"]["journey"]
        assert len(journey) == 1
        assert journey[0]["type"] == "submit"
        assert journey[0]["label"].startswith("Order #")

    def test_submit_step_has_padded_number(self, client):
        client.post("/api/session", json={"sessionId": "j31", "selections": {"p1": {}}})
        r = client.post("/api/session/j31/submit")
        num = r.get_json()["orderNumber"]
        import app as flask_app
        step = flask_app.sessions["j31"]["journey"][-1]
        assert step["label"] == f"Order #{str(num).zfill(2)}"


class TestJourneyInListEndpoint:
    def test_get_sessions_includes_journey(self, client):
        client.post("/api/session", json={"sessionId": "j40", "selections": {"p1": {}}})
        client.post("/api/session/heartbeat", json={"sessionId": "j40", "route": "/flower"})
        client.post("/api/session/journey", json={"sessionId": "j40", "type": "add", "label": "A +1"})
        r = client.get("/api/sessions")
        session = [s for s in r.get_json() if s["sessionId"] == "j40"][0]
        assert "journey" in session
        assert len(session["journey"]) == 2
        assert session["journey"][0]["type"] == "navigate"
        assert session["journey"][1]["type"] == "add"


class TestJourneyCartShare:
    def test_cart_share_appends_share_step(self, client):
        client.post("/api/session", json={"sessionId": "j50", "selections": {"p1": {"name": "A"}}})
        client.get("/api/session/j50")
        import app as flask_app
        journey = flask_app.sessions["j50"]["journey"]
        assert any(s["type"] == "share" for s in journey)
        assert journey[-1]["label"] == "Cart shared to phone"

    def test_cart_share_step_not_duplicated(self, client):
        client.post("/api/session", json={"sessionId": "j51", "selections": {"p1": {"name": "A"}}})
        client.get("/api/session/j51")
        client.get("/api/session/j51")
        client.get("/api/session/j51")
        import app as flask_app
        share_steps = [s for s in flask_app.sessions["j51"]["journey"] if s["type"] == "share"]
        assert len(share_steps) == 1
