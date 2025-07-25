import time
import json
import asyncio
from typing import Dict, Any, Optional, Tuple
import logging

from config import settings
from redis_client import RedisClient

logger = logging.getLogger(__name__)

class TokenBucketRateLimiter:
    def __init__(self, redis_client: RedisClient):
        self.redis = redis_client
        self.config = settings.DEFAULT_RATE_LIMITS
        self.config_key = "rate_limit_config"
        self.bucket_prefix = "bucket:"
        self.stats_prefix = "stats:"
    
    async def update_config(self, new_config: Dict[str, Any]):
        """Update rate limiting configuration"""
        self.config = new_config
        logger.info("Rate limiting configuration updated")
    
    async def get_config(self) -> Dict[str, Any]:
        """Get current configuration from Redis or use default"""
        try:
            config_str = await self.redis.get(self.config_key)
            if config_str:
                self.config = json.loads(config_str)
                return self.config
        except Exception as e:
            logger.error(f"Error getting config from Redis: {e}")
        
        return self.config
    
    def _get_rate_limit_for_endpoint(self, endpoint: str, method: str, user_id: str) -> Tuple[int, int]:
        """Get rate limit configuration for specific endpoint and user"""
        # Check for user-specific overrides first
        user_overrides = self.config.get("user_overrides", {})
        if user_id in user_overrides:
            user_config = user_overrides[user_id]
            return (
                user_config.get("requests_per_minute", self.config["default_requests_per_minute"]),
                user_config.get("burst_size", self.config.get("default_burst_size", 10))
            )
        
        # Check for endpoint-specific limits
        endpoints = self.config.get("endpoints", {})
        if endpoint in endpoints:
            endpoint_config = endpoints[endpoint]
            if method in endpoint_config:
                method_config = endpoint_config[method]
                return (
                    method_config.get("requests_per_minute", self.config["default_requests_per_minute"]),
                    method_config.get("burst_size", self.config.get("default_burst_size", 10))
                )
        
        # Return default limits
        return (
            self.config["default_requests_per_minute"],
            self.config.get("default_burst_size", 10)
        )
    
    async def _get_token_bucket(self, bucket_key: str, max_tokens: int, refill_rate: float) -> Tuple[int, float]:
        """Get current state of token bucket"""
        try:
            bucket_data = await self.redis.hgetall(bucket_key)
            
            if not bucket_data:
                # Initialize new bucket
                current_time = time.time()
                await self.redis.hset(bucket_key, "tokens", str(max_tokens))
                await self.redis.hset(bucket_key, "last_refill", str(current_time))
                await self.redis.expire(bucket_key, 3600)  # Expire after 1 hour of inactivity
                return max_tokens, current_time
            
            tokens = float(bucket_data.get("tokens", max_tokens))
            last_refill = float(bucket_data.get("last_refill", time.time()))
            
            return tokens, last_refill
            
        except Exception as e:
            logger.error(f"Error getting token bucket {bucket_key}: {e}")
            return max_tokens, time.time()
    
    async def _update_token_bucket(self, bucket_key: str, tokens: int, timestamp: float):
        """Update token bucket state"""
        try:
            await self.redis.hset(bucket_key, "tokens", str(tokens))
            await self.redis.hset(bucket_key, "last_refill", str(timestamp))
            await self.redis.expire(bucket_key, 3600)  # Reset expiration
        except Exception as e:
            logger.error(f"Error updating token bucket {bucket_key}: {e}")
    
    async def is_allowed(self, user_id: str, endpoint: str, method: str) -> bool:
        """Check if request is allowed based on rate limits"""
        try:
            # Get rate limit configuration
            requests_per_minute, burst_size = self._get_rate_limit_for_endpoint(endpoint, method, user_id)
            
            # Calculate refill rate (tokens per second)
            refill_rate = requests_per_minute / 60.0
            max_tokens = burst_size
            
            # Create bucket key
            bucket_key = f"{self.bucket_prefix}{user_id}:{endpoint}:{method}"
            
            # Get current bucket state
            current_tokens, last_refill = await self._get_token_bucket(bucket_key, max_tokens, refill_rate)
            
            # Calculate time elapsed and refill tokens
            current_time = time.time()
            time_elapsed = current_time - last_refill
            
            # Add tokens based on time elapsed
            tokens_to_add = time_elapsed * refill_rate
            new_tokens = min(max_tokens, current_tokens + tokens_to_add)
            
            # Check if we have at least 1 token
            if new_tokens >= 1:
                # Consume 1 token
                new_tokens -= 1
                await self._update_token_bucket(bucket_key, int(new_tokens), current_time)
                
                # Update statistics
                await self._update_stats(user_id, endpoint, method, True)
                
                return True
            else:
                # Rate limit exceeded
                await self._update_token_bucket(bucket_key, int(new_tokens), current_time)
                await self._update_stats(user_id, endpoint, method, False)
                
                return False
                
        except Exception as e:
            logger.error(f"Error in rate limiting check: {e}")
            # In case of error, allow the request (fail open)
            return True
    
    async def _update_stats(self, user_id: str, endpoint: str, method: str, allowed: bool):
        """Update statistics for monitoring"""
        try:
            current_time = time.time()
            minute_key = int(current_time // 60)  # Current minute
            
            # Global stats
            global_stats_key = f"{self.stats_prefix}global:{minute_key}"
            await self.redis.incr(f"{global_stats_key}:total")
            if allowed:
                await self.redis.incr(f"{global_stats_key}:allowed")
            else:
                await self.redis.incr(f"{global_stats_key}:blocked")
            await self.redis.expire(f"{global_stats_key}:total", 3600)
            await self.redis.expire(f"{global_stats_key}:allowed", 3600)
            await self.redis.expire(f"{global_stats_key}:blocked", 3600)
            
            # User stats
            user_stats_key = f"{self.stats_prefix}user:{user_id}:{minute_key}"
            await self.redis.incr(f"{user_stats_key}:total")
            if allowed:
                await self.redis.incr(f"{user_stats_key}:allowed")
            else:
                await self.redis.incr(f"{user_stats_key}:blocked")
            await self.redis.expire(f"{user_stats_key}:total", 3600)
            await self.redis.expire(f"{user_stats_key}:allowed", 3600)
            await self.redis.expire(f"{user_stats_key}:blocked", 3600)
            
            # Endpoint stats
            endpoint_stats_key = f"{self.stats_prefix}endpoint:{endpoint}:{method}:{minute_key}"
            await self.redis.incr(f"{endpoint_stats_key}:total")
            if allowed:
                await self.redis.incr(f"{endpoint_stats_key}:allowed")
            else:
                await self.redis.incr(f"{endpoint_stats_key}:blocked")
            await self.redis.expire(f"{endpoint_stats_key}:total", 3600)
            await self.redis.expire(f"{endpoint_stats_key}:allowed", 3600)
            await self.redis.expire(f"{endpoint_stats_key}:blocked", 3600)
            
        except Exception as e:
            logger.error(f"Error updating stats: {e}")
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get overall statistics"""
        try:
            current_time = time.time()
            current_minute = int(current_time // 60)
            
            # Get stats for last 5 minutes
            stats = {
                "current_minute": current_minute,
                "global_stats": [],
                "top_users": [],
                "top_endpoints": []
            }
            
            # Global stats for last 5 minutes
            for i in range(5):
                minute_key = current_minute - i
                global_stats_key = f"{self.stats_prefix}global:{minute_key}"
                
                total = await self.redis.get(f"{global_stats_key}:total") or "0"
                allowed = await self.redis.get(f"{global_stats_key}:allowed") or "0"
                blocked = await self.redis.get(f"{global_stats_key}:blocked") or "0"
                
                stats["global_stats"].append({
                    "minute": minute_key,
                    "total": int(total),
                    "allowed": int(allowed),
                    "blocked": int(blocked)
                })
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {"error": "Failed to get statistics"}
    
    async def get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """Get statistics for a specific user"""
        try:
            current_time = time.time()
            current_minute = int(current_time // 60)
            
            stats = {
                "user_id": user_id,
                "current_minute": current_minute,
                "user_stats": [],
                "current_buckets": {}
            }
            
            # User stats for last 5 minutes
            for i in range(5):
                minute_key = current_minute - i
                user_stats_key = f"{self.stats_prefix}user:{user_id}:{minute_key}"
                
                total = await self.redis.get(f"{user_stats_key}:total") or "0"
                allowed = await self.redis.get(f"{user_stats_key}:allowed") or "0"
                blocked = await self.redis.get(f"{user_stats_key}:blocked") or "0"
                
                stats["user_stats"].append({
                    "minute": minute_key,
                    "total": int(total),
                    "allowed": int(allowed),
                    "blocked": int(blocked)
                })
            
            # Current token bucket states
            bucket_pattern = f"{self.bucket_prefix}{user_id}:*"
            bucket_keys = await self.redis.keys(bucket_pattern)
            
            for bucket_key in bucket_keys:
                bucket_data = await self.redis.hgetall(bucket_key)
                if bucket_data:
                    endpoint_method = bucket_key.replace(f"{self.bucket_prefix}{user_id}:", "")
                    stats["current_buckets"][endpoint_method] = {
                        "tokens": float(bucket_data.get("tokens", 0)),
                        "last_refill": float(bucket_data.get("last_refill", 0))
                    }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting user stats for {user_id}: {e}")
            return {"error": f"Failed to get statistics for user {user_id}"}
    
    async def reset_user_limits(self, user_id: str):
        """Reset all rate limits for a specific user"""
        try:
            bucket_pattern = f"{self.bucket_prefix}{user_id}:*"
            bucket_keys = await self.redis.keys(bucket_pattern)
            
            for bucket_key in bucket_keys:
                await self.redis.delete(bucket_key)
            
            logger.info(f"Reset rate limits for user {user_id}")
            
        except Exception as e:
            logger.error(f"Error resetting limits for user {user_id}: {e}")
    
    async def get_remaining_tokens(self, user_id: str, endpoint: str, method: str) -> Dict[str, Any]:
        """Get remaining tokens for a specific user/endpoint combination"""
        try:
            requests_per_minute, burst_size = self._get_rate_limit_for_endpoint(endpoint, method, user_id)
            refill_rate = requests_per_minute / 60.0
            max_tokens = burst_size
            
            bucket_key = f"{self.bucket_prefix}{user_id}:{endpoint}:{method}"
            current_tokens, last_refill = await self._get_token_bucket(bucket_key, max_tokens, refill_rate)
            
            # Calculate current tokens after refill
            current_time = time.time()
            time_elapsed = current_time - last_refill
            tokens_to_add = time_elapsed * refill_rate
            actual_tokens = min(max_tokens, current_tokens + tokens_to_add)
            
            return {
                "remaining_tokens": int(actual_tokens),
                "max_tokens": max_tokens,
                "refill_rate_per_second": refill_rate,
                "requests_per_minute": requests_per_minute
            }
            
        except Exception as e:
            logger.error(f"Error getting remaining tokens: {e}")
            return {"error": "Failed to get remaining tokens"}