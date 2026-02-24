"""
Tests for the module registry routes:
  GET  /api/config/modules
  GET  /api/config/modules/{module_id}
  POST /api/config/modules/register
  GET  /api/config/modules/{module_id}/config/{instance_id}
  PUT  /api/config/modules/{module_id}/config/{instance_id}
"""
from __future__ import annotations

from .conftest import AUTH_HEADERS

_CLOCK_MANIFEST = {
    "id": "clock",
    "name": "Clock",
    "description": "Digital clock",
    "version": "1.0.0",
    "author": "OzMirror",
    "defaultConfig": {"format": "HH:mm:ss", "timezone": "UTC", "showDate": True},
    "configSchema": None,
    "gridConstraints": {
        "minW": 2,
        "minH": 2,
        "maxW": 8,
        "maxH": 4,
        "defaultW": 4,
        "defaultH": 3,
    },
}

_REGISTER_CLOCK_BODY = {
    "id": "clock",
    "name": "Clock",
    "serviceUrl": "http://clock-module:3001",
    "manifest": _CLOCK_MANIFEST,
    "status": "online",
}


def _register_clock(client):
    return client.post(
        "/api/config/modules/register",
        json=_REGISTER_CLOCK_BODY,
        headers=AUTH_HEADERS,
    )


# ---------------------------------------------------------------------------
# GET /api/config/modules
# ---------------------------------------------------------------------------


class TestListModules:
    def test_empty_registry_returns_empty_list(self, client):
        r = client.get("/api/config/modules")
        assert r.status_code == 200
        assert r.json() == []

    def test_returns_registered_module(self, client):
        _register_clock(client)
        r = client.get("/api/config/modules")
        assert r.status_code == 200
        ids = [m["id"] for m in r.json()]
        assert "clock" in ids


# ---------------------------------------------------------------------------
# GET /api/config/modules/{module_id}
# ---------------------------------------------------------------------------


class TestGetModule:
    def test_returns_registered_module(self, client):
        _register_clock(client)
        r = client.get("/api/config/modules/clock")
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == "clock"
        assert body["status"] == "online"

    def test_unknown_module_returns_404(self, client):
        r = client.get("/api/config/modules/ghost")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/config/modules/register
# ---------------------------------------------------------------------------


class TestRegisterModule:
    def test_registers_new_module(self, client):
        r = _register_clock(client)
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_re_registration_updates_record(self, client):
        _register_clock(client)
        updated = dict(_REGISTER_CLOCK_BODY)
        updated["status"] = "offline"
        client.post(
            "/api/config/modules/register",
            json=updated,
            headers=AUTH_HEADERS,
        )
        body = client.get("/api/config/modules/clock").json()
        assert body["status"] == "offline"

    def test_requires_api_key(self, client):
        r = client.post("/api/config/modules/register", json=_REGISTER_CLOCK_BODY)
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/config/modules/{module_id}/config/{instance_id}
# ---------------------------------------------------------------------------


class TestGetInstanceConfig:
    def test_returns_saved_config_from_layout(self, client):
        """The seeded default layout has clock_01; its config should be returned."""
        r = client.get("/api/config/modules/clock/config/clock_01")
        assert r.status_code == 200
        body = r.json()
        assert "format" in body

    def test_falls_back_to_manifest_default_config(self, client):
        """If no saved config for instance_id, fall back to manifest defaultConfig."""
        _register_clock(client)
        r = client.get("/api/config/modules/clock/config/clock_99")
        assert r.status_code == 200
        assert r.json()["format"] == "HH:mm:ss"

    def test_404_when_neither_instance_nor_module_found(self, client):
        r = client.get("/api/config/modules/ghost/config/ghost_01")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# PUT /api/config/modules/{module_id}/config/{instance_id}
# ---------------------------------------------------------------------------


class TestUpdateInstanceConfig:
    def test_updates_instance_config(self, client):
        new_config = {"format": "hh:mm A", "timezone": "America/New_York", "showDate": False}
        r = client.put(
            "/api/config/modules/clock/config/clock_01",
            json=new_config,
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 200
        assert r.json()["success"] is True

        saved = client.get("/api/config/modules/clock/config/clock_01").json()
        assert saved["timezone"] == "America/New_York"
        assert saved["showDate"] is False

    def test_404_for_unknown_instance(self, client):
        r = client.put(
            "/api/config/modules/clock/config/nonexistent",
            json={"format": "HH:mm"},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 404

    def test_requires_api_key(self, client):
        r = client.put(
            "/api/config/modules/clock/config/clock_01",
            json={"format": "HH:mm"},
        )
        assert r.status_code == 401
