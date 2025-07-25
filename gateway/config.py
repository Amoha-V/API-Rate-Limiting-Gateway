import os
from typing import Dict, Any

class Settings:
    # Redis configuration
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
    REDIS_DB = int(os.getenv("REDIS_DB", 0))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)
    
    # JWT configuration
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRATION_HOURS = 24
    
    # Admin credentials (in production, use proper user management)
    ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
    
    # Default rate limiting configuration
    DEFAULT_RATE_LIMITS: Dict[str, Any] = {
        "default_requests_per_minute": 60,
        "default_burst_size": 10,
        "endpoints": {
            "/api/users": {
                "GET": {"requests_per_minute": 100, "burst_size": 20},
                "POST": {"requests_per_minute": 30, "burst_size": 5}
            },
            "/api/data": {
                "GET": {"requests_per_minute": 200, "burst_size": 50},
                "POST": {"requests_per_minute": 50, "burst_size": 10}
            }
        },
        "user_overrides": {
            # Example: Premium users with higher limits
            "premium_user_123": {
                "requests_per_minute": 500,
                "burst_size": 100
            }
        }
    }
    
    # Rate limiter settings
    TOKEN_BUCKET_REFILL_RATE = 1.0  # tokens per second
    TOKEN_BUCKET_MAX_TOKENS = 100
    
    # Gateway settings
    GATEWAY_HOST = os.getenv("GATEWAY_HOST", "0.0.0.0")
    GATEWAY_PORT = int(os.getenv("GATEWAY_PORT", 8000))
    
    # Admin API settings
    ADMIN_API_URL = os.getenv("ADMIN_API_URL", "http://localhost:3001")

settings = Settings()