import redis.asyncio as redis
import json
from typing import Optional, Any, Dict
import logging

from config import settings

logger = logging.getLogger(__name__)

class RedisClient:
    def __init__(self):
        self.redis = None
        self.connected = False
    
    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis = redis.from_url(
                f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}",
                password=settings.REDIS_PASSWORD,
                encoding="utf-8",
                decode_responses=True
            )
            # Test connection
            await self.redis.ping()
            self.connected = True
            logger.info("✅ Connected to Redis successfully")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis: {e}")
            raise

    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis:
            await self.redis.close()
            self.connected = False
            logger.info("✅ Disconnected from Redis")

    async def get(self, key: str) -> Optional[str]:
        """Get value from Redis"""
        try:
            return await self.redis.get(key)
        except Exception as e:
            logger.error(f"Redis GET error for key {key}: {e}")
            return None

    async def set(self, key: str, value: str, ex: Optional[int] = None):
        """Set value in Redis with optional expiration"""
        try:
            await self.redis.set(key, value, ex=ex)
        except Exception as e:
            logger.error(f"Redis SET error for key {key}: {e}")

    async def incr(self, key: str) -> int:
        """Increment value in Redis"""
        try:
            return await self.redis.incr(key)
        except Exception as e:
            logger.error(f"Redis INCR error for key {key}: {e}")
            return 0

    async def expire(self, key: str, seconds: int):
        """Set expiration for a key"""
        try:
            await self.redis.expire(key, seconds)
        except Exception as e:
            logger.error(f"Redis EXPIRE error for key {key}: {e}")

    async def delete(self, key: str):
        """Delete key from Redis"""
        try:
            await self.redis.delete(key)
        except Exception as e:
            logger.error(f"Redis DELETE error for key {key}: {e}")

    async def hget(self, name: str, key: str) -> Optional[str]:
        """Get field from Redis hash"""
        try:
            return await self.redis.hget(name, key)
        except Exception as e:
            logger.error(f"Redis HGET error for hash {name}, key {key}: {e}")
            return None

    async def hset(self, name: str, key: str, value: str):
        """Set field in Redis hash"""
        try:
            await self.redis.hset(name, key, value)
        except Exception as e:
            logger.error(f"Redis HSET error for hash {name}, key {key}: {e}")

    async def hgetall(self, name: str) -> Dict[str, str]:
        """Get all fields from Redis hash"""
        try:
            return await self.redis.hgetall(name)
        except Exception as e:
            logger.error(f"Redis HGETALL error for hash {name}: {e}")
            return {}

    async def exists(self, key: str) -> bool:
        """Check if key exists in Redis"""
        try:
            return await self.redis.exists(key) > 0
        except Exception as e:
            logger.error(f"Redis EXISTS error for key {key}: {e}")
            return False

    async def keys(self, pattern: str = "*"):
        """Get keys matching pattern"""
        try:
            return await self.redis.keys(pattern)
        except Exception as e:
            logger.error(f"Redis KEYS error for pattern {pattern}: {e}")
            return []

    async def get_json(self, key: str) -> Optional[Dict[str, Any]]:
        """Get JSON value from Redis"""
        try:
            value = await self.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Redis GET_JSON error for key {key}: {e}")
            return None

    async def set_json(self, key: str, value: Dict[str, Any], ex: Optional[int] = None):
        """Set JSON value in Redis"""
        try:
            json_str = json.dumps(value)
            await self.set(key, json_str, ex=ex)
        except Exception as e:
            logger.error(f"Redis SET_JSON error for key {key}: {e}")

    def is_connected(self) -> bool:
        """Check if Redis is connected"""
        return self.connected
