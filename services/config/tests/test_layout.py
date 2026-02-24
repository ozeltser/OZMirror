"""
Tests for the layout routes:
  GET  /api/config/layout
  PUT  /api/config/layout
  GET  /api/config/layout/profiles
  POST /api/config/layout/profiles
  PUT  /api/config/layout/active-profile
  DELETE /api/config/layout/profiles/{name}
"""
from __future__ import annotations

from .conftest import AUTH_HEADERS


# ---------------------------------------------------------------------------
# GET /api/config/layout
# ---------------------------------------------------------------------------


class TestGetLayout:
    def test_returns_200_with_seeded_data(self, client):
        r = client.get("/api/config/layout")
        assert r.status_code == 200
        body = r.json()
        assert body["activeProfile"] == "default"
        assert "default" in body["layouts"]

    def test_default_profile_has_grid_and_module_configs(self, client):
        body = client.get("/api/config/layout").json()
        default = body["layouts"]["default"]
        assert "grid" in default
        assert "moduleConfigs" in default


# ---------------------------------------------------------------------------
# GET /api/config/layout/profiles
# ---------------------------------------------------------------------------


class TestListProfiles:
    def test_returns_list_containing_default(self, client):
        r = client.get("/api/config/layout/profiles")
        assert r.status_code == 200
        assert "default" in r.json()


# ---------------------------------------------------------------------------
# PUT /api/config/layout  (requires auth)
# ---------------------------------------------------------------------------


class TestUpdateLayout:
    _valid_body = {
        "profileName": "default",
        "grid": [{"i": "clock_01", "x": 0, "y": 0, "w": 4, "h": 3}],
        "moduleConfigs": {
            "clock_01": {
                "moduleId": "clock",
                "config": {"format": "HH:mm", "timezone": "UTC", "showDate": False},
            }
        },
    }

    def test_requires_api_key(self, client):
        r = client.put("/api/config/layout", json=self._valid_body)
        assert r.status_code == 401

    def test_wrong_api_key_rejected(self, client):
        r = client.put(
            "/api/config/layout",
            json=self._valid_body,
            headers={"X-API-Key": "wrong"},
        )
        assert r.status_code == 401

    def test_update_persists(self, client):
        r = client.put(
            "/api/config/layout",
            json=self._valid_body,
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 200
        assert r.json()["success"] is True

        layout = client.get("/api/config/layout").json()
        clock_cfg = layout["layouts"]["default"]["moduleConfigs"]["clock_01"]["config"]
        assert clock_cfg["format"] == "HH:mm"
        assert clock_cfg["showDate"] is False

    def test_upserts_new_profile(self, client):
        """PUT can create/update a named profile even if it didn't exist before."""
        body = {
            "profileName": "tv",
            "grid": [],
            "moduleConfigs": {},
        }
        r = client.put("/api/config/layout", json=body, headers=AUTH_HEADERS)
        assert r.status_code == 200

        profiles = client.get("/api/config/layout/profiles").json()
        assert "tv" in profiles


# ---------------------------------------------------------------------------
# POST /api/config/layout/profiles  (requires auth)
# ---------------------------------------------------------------------------


class TestCreateProfile:
    def test_creates_profile_copied_from_default(self, client):
        r = client.post(
            "/api/config/layout/profiles",
            json={"name": "night", "copyFrom": "default"},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 201
        assert r.json()["success"] is True
        assert "night" in client.get("/api/config/layout/profiles").json()

    def test_duplicate_profile_returns_409(self, client):
        client.post(
            "/api/config/layout/profiles",
            json={"name": "dup", "copyFrom": "default"},
            headers=AUTH_HEADERS,
        )
        r = client.post(
            "/api/config/layout/profiles",
            json={"name": "dup", "copyFrom": "default"},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 409

    def test_unknown_copy_from_returns_404(self, client):
        r = client.post(
            "/api/config/layout/profiles",
            json={"name": "new", "copyFrom": "ghost"},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 404

    def test_requires_api_key(self, client):
        r = client.post(
            "/api/config/layout/profiles",
            json={"name": "x", "copyFrom": "default"},
        )
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# PUT /api/config/layout/active-profile  (requires auth)
# ---------------------------------------------------------------------------


class TestSetActiveProfile:
    def test_switches_active_profile(self, client):
        # Create profile first
        client.post(
            "/api/config/layout/profiles",
            json={"name": "cinema", "copyFrom": "default"},
            headers=AUTH_HEADERS,
        )
        r = client.put(
            "/api/config/layout/active-profile",
            json={"name": "cinema"},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 200
        layout = client.get("/api/config/layout").json()
        assert layout["activeProfile"] == "cinema"

    def test_unknown_profile_returns_404(self, client):
        r = client.put(
            "/api/config/layout/active-profile",
            json={"name": "ghost"},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 404

    def test_invalid_profile_name_returns_422(self, client):
        r = client.put(
            "/api/config/layout/active-profile",
            json={"name": "bad name!"},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 422

    def test_requires_api_key(self, client):
        r = client.put(
            "/api/config/layout/active-profile",
            json={"name": "default"},
        )
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# DELETE /api/config/layout/profiles/{name}  (requires auth)
# ---------------------------------------------------------------------------


class TestDeleteProfile:
    def test_deletes_profile(self, client):
        client.post(
            "/api/config/layout/profiles",
            json={"name": "temp", "copyFrom": "default"},
            headers=AUTH_HEADERS,
        )
        r = client.delete("/api/config/layout/profiles/temp", headers=AUTH_HEADERS)
        assert r.status_code == 200
        assert "temp" not in client.get("/api/config/layout/profiles").json()

    def test_cannot_delete_default_profile(self, client):
        r = client.delete("/api/config/layout/profiles/default", headers=AUTH_HEADERS)
        assert r.status_code == 400

    def test_deleting_nonexistent_profile_returns_404(self, client):
        r = client.delete("/api/config/layout/profiles/ghost", headers=AUTH_HEADERS)
        assert r.status_code == 404

    def test_deleting_active_profile_resets_to_default(self, client):
        # Create and activate a non-default profile
        client.post(
            "/api/config/layout/profiles",
            json={"name": "active_one", "copyFrom": "default"},
            headers=AUTH_HEADERS,
        )
        client.put(
            "/api/config/layout/active-profile",
            json={"name": "active_one"},
            headers=AUTH_HEADERS,
        )
        # Delete it
        client.delete("/api/config/layout/profiles/active_one", headers=AUTH_HEADERS)
        layout = client.get("/api/config/layout").json()
        assert layout["activeProfile"] == "default"

    def test_requires_api_key(self, client):
        r = client.delete("/api/config/layout/profiles/default")
        assert r.status_code == 401
