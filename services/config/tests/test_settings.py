"""
Tests for the settings and themes routes:
  GET  /api/config/settings
  PUT  /api/config/settings
  GET  /api/config/themes
  POST /api/config/themes
"""
from __future__ import annotations

from .conftest import AUTH_HEADERS


# ---------------------------------------------------------------------------
# GET /api/config/settings
# ---------------------------------------------------------------------------


class TestGetSettings:
    def test_returns_seeded_defaults(self, client):
        r = client.get("/api/config/settings")
        assert r.status_code == 200
        body = r.json()
        assert body["theme"] == "dark"
        assert body["kiosk"] is False
        assert body["fontScale"] == 1.0
        assert body["autoStart"] is False

    def test_response_shape(self, client):
        body = client.get("/api/config/settings").json()
        expected_keys = {"theme", "kiosk", "cursorTimeout", "fontScale", "autoStart"}
        assert expected_keys == set(body.keys())


# ---------------------------------------------------------------------------
# PUT /api/config/settings
# ---------------------------------------------------------------------------


class TestUpdateSettings:
    _updated = {
        "theme": "light",
        "kiosk": True,
        "cursorTimeout": 5000,
        "fontScale": 1.2,
        "autoStart": True,
    }

    def test_persists_all_fields(self, client):
        r = client.put("/api/config/settings", json=self._updated, headers=AUTH_HEADERS)
        assert r.status_code == 200
        assert r.json()["success"] is True

        settings = client.get("/api/config/settings").json()
        assert settings["theme"] == "light"
        assert settings["kiosk"] is True
        assert settings["fontScale"] == 1.2
        assert settings["autoStart"] is True

    def test_round_trip_amoled_theme(self, client):
        body = dict(self._updated, theme="amoled")
        client.put("/api/config/settings", json=body, headers=AUTH_HEADERS)
        assert client.get("/api/config/settings").json()["theme"] == "amoled"

    def test_requires_api_key(self, client):
        r = client.put("/api/config/settings", json=self._updated)
        assert r.status_code == 401

    def test_wrong_key_rejected(self, client):
        r = client.put(
            "/api/config/settings",
            json=self._updated,
            headers={"X-API-Key": "bad"},
        )
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/config/themes
# ---------------------------------------------------------------------------


class TestGetThemes:
    def test_returns_seeded_built_in_themes(self, client):
        r = client.get("/api/config/themes")
        assert r.status_code == 200
        themes = r.json()
        ids = [t["id"] for t in themes]
        assert "dark" in ids
        assert "light" in ids
        assert "amoled" in ids

    def test_theme_has_variables(self, client):
        themes = client.get("/api/config/themes").json()
        dark = next(t for t in themes if t["id"] == "dark")
        assert "--color-bg" in dark["variables"]


# ---------------------------------------------------------------------------
# POST /api/config/themes
# ---------------------------------------------------------------------------


class TestUpsertTheme:
    _new_theme = {
        "id": "forest",
        "name": "Forest",
        "variables": {
            "--color-bg": "#1b2e1b",
            "--color-text": "#d4edda",
        },
    }

    def test_creates_new_theme(self, client):
        r = client.post("/api/config/themes", json=self._new_theme, headers=AUTH_HEADERS)
        assert r.status_code == 201
        assert r.json()["success"] is True

        ids = [t["id"] for t in client.get("/api/config/themes").json()]
        assert "forest" in ids

    def test_updates_existing_theme(self, client):
        updated = {"id": "dark", "name": "Dark v2", "variables": {"--color-bg": "#111"}}
        client.post("/api/config/themes", json=updated, headers=AUTH_HEADERS)
        dark = next(
            t for t in client.get("/api/config/themes").json() if t["id"] == "dark"
        )
        assert dark["name"] == "Dark v2"

    def test_requires_api_key(self, client):
        r = client.post("/api/config/themes", json=self._new_theme)
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Health endpoint (infrastructure)
# ---------------------------------------------------------------------------


class TestHealth:
    def test_health_returns_200(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "healthy"
        assert "version" in body
        assert "uptime" in body
