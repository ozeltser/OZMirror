"""
Tests for the config validation route:
  POST /api/config/validate
"""
from __future__ import annotations

from .conftest import AUTH_HEADERS

_SCHEMA_MANIFEST = {
    "id": "weather",
    "name": "Weather",
    "description": "Current conditions",
    "version": "1.0.0",
    "author": "OzMirror",
    "defaultConfig": {"city": "Sydney"},
    "configSchema": {
        "type": "object",
        "properties": {
            "city": {"type": "string"},
            "units": {"type": "string", "enum": ["metric", "imperial"]},
        },
        "required": ["city"],
        "additionalProperties": False,
    },
    "gridConstraints": None,
}

_REGISTER_WEATHER_BODY = {
    "id": "weather",
    "name": "Weather",
    "serviceUrl": "http://weather-module:3001",
    "manifest": _SCHEMA_MANIFEST,
    "status": "online",
}

_NO_SCHEMA_MANIFEST = {
    "id": "clock",
    "name": "Clock",
    "description": "Digital clock",
    "version": "1.0.0",
    "author": "OzMirror",
    "defaultConfig": {},
    "configSchema": None,
    "gridConstraints": None,
}

_REGISTER_CLOCK_BODY = {
    "id": "clock",
    "name": "Clock",
    "serviceUrl": "http://clock-module:3001",
    "manifest": _NO_SCHEMA_MANIFEST,
    "status": "online",
}


def _register_weather(client):
    return client.post(
        "/api/config/modules/register",
        json=_REGISTER_WEATHER_BODY,
        headers=AUTH_HEADERS,
    )


def _register_clock(client):
    return client.post(
        "/api/config/modules/register",
        json=_REGISTER_CLOCK_BODY,
        headers=AUTH_HEADERS,
    )


# ---------------------------------------------------------------------------
# POST /api/config/validate
# ---------------------------------------------------------------------------


class TestValidateConfig:
    def test_valid_config_returns_valid_true(self, client):
        _register_weather(client)
        r = client.post(
            "/api/config/validate",
            json={"moduleId": "weather", "config": {"city": "Sydney", "units": "metric"}},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["valid"] is True
        assert body.get("errors") is None

    def test_invalid_config_returns_valid_false_with_errors(self, client):
        _register_weather(client)
        r = client.post(
            "/api/config/validate",
            json={"moduleId": "weather", "config": {"units": "bad-unit"}},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["valid"] is False
        assert isinstance(body["errors"], list)
        assert len(body["errors"]) > 0

    def test_missing_required_field_is_an_error(self, client):
        _register_weather(client)
        r = client.post(
            "/api/config/validate",
            json={"moduleId": "weather", "config": {}},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["valid"] is False
        assert any("city" in err for err in body["errors"])

    def test_additional_property_is_an_error(self, client):
        _register_weather(client)
        r = client.post(
            "/api/config/validate",
            json={"moduleId": "weather", "config": {"city": "Sydney", "unknown_field": True}},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 200
        assert r.json()["valid"] is False

    def test_unknown_module_returns_404(self, client):
        r = client.post(
            "/api/config/validate",
            json={"moduleId": "ghost", "config": {}},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 404

    def test_module_without_schema_returns_404(self, client):
        _register_clock(client)
        r = client.post(
            "/api/config/validate",
            json={"moduleId": "clock", "config": {}},
            headers=AUTH_HEADERS,
        )
        assert r.status_code == 404

    def test_requires_api_key(self, client):
        r = client.post(
            "/api/config/validate",
            json={"moduleId": "weather", "config": {}},
        )
        assert r.status_code == 401
