"""
Redis publisher for the Config Service.

Publishes a config-change event to `events:config:<module_id>` whenever
an instance config is updated. Module containers subscribe to their own
channel and immediately invalidate their Redis data cache, so stale
data is never served after a config change.

This client is intentionally publish-only — the Config Service has no
reason to read from Redis.
"""

from __future__ import annotations

import json
import logging
import os

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


async def connect() -> None:
    """Open an async Redis connection. Called once during app lifespan startup."""
    global _redis
    url = os.getenv("REDIS_URL", "redis://redis:6379")
    password = os.getenv("REDIS_PASSWORD") or None
    _redis = aioredis.from_url(url, password=password, decode_responses=True)
    await _redis.ping()
    logger.info("Redis publisher connected")


async def close() -> None:
    """Close the Redis connection. Called once during app lifespan shutdown."""
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
        logger.info("Redis publisher closed")


async def publish_config_changed(module_id: str, instance_id: str) -> None:
    """
    Publish a config-change notification for one module instance.

    Channel:  events:config:<module_id>
    Payload:  {"instanceId": "<instance_id>"}

    Failures are logged and swallowed — a Redis blip must never cause a
    config save to fail.
    """
    if _redis is None:
        logger.warning(
            "Redis not connected — skipping config-change event "
            "(module=%s instance=%s)",
            module_id,
            instance_id,
        )
        return

    channel = f"events:config:{module_id}"
    payload = json.dumps({"instanceId": instance_id})
    try:
        await _redis.publish(channel, payload)
        logger.debug(
            "Config-change event published: channel=%s instanceId=%s",
            channel,
            instance_id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Failed to publish config-change event (module=%s instance=%s): %s",
            module_id,
            instance_id,
            exc,
        )
