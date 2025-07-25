from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time
import json
from typing import Optional, Dict, Any
import asyncio
import os

from config import settings
from auth import verify_jwt_token, create_access_token
from rate_limiter import TokenBucketRateLimiter
from redis_client import RedisClient

# Initialize services globally
redis_client = RedisClient()
rate_limiter = TokenBucketRateLimiter(redis_client)
security = HTTPBearer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await redis_client.connect()
    print("✅ API Gateway started successfully")
    
    yield  # Application runs here
    
    # Shutdown
    await redis_client.disconnect()
    print("🔌 API Gateway shutdown complete")

app = FastAPI(
    title="API Rate Limiting Gateway",
    description="A high-performance API gateway with token bucket rate limiting",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

GATEWAY_PORT = int(os.getenv("GATEWAY_PORT", 8000))

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Skip rate limiting for docs and admin endpoints
    if request.url.path in ["/docs", "/redoc", "/openapi.json", "/admin/login", "/health"]:
        response = await call_next(request)
        return response
    
    # Extract user from JWT token
    user_id = None
    auth_header = request.headers.get("authorization")
    
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = verify_jwt_token(token)
            user_id = payload.get("sub")
        except Exception:
            return JSONResponse(
                status_code=401,
                content={"error": "Invalid token"}
            )
    
    if not user_id:
        return JSONResponse(
            status_code=401,
            content={"error": "Authentication required"}
        )
    
    # Check rate limit
    endpoint = request.url.path
    method = request.method
    
    allowed = await rate_limiter.is_allowed(user_id, endpoint, method)
    
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={
                "error": "Rate limit exceeded",
                "message": "Too many requests. Please try again later."
            }
        )
    
    response = await call_next(request)
    return response

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": time.time()}

# Authentication endpoints
@app.post("/admin/login")
async def admin_login(credentials: dict):
    """Admin login endpoint"""
    username = credentials.get("username")
    password = credentials.get("password")
    
    # Simple admin credentials (in production, use proper user management)
    if username == settings.ADMIN_USERNAME and password == settings.ADMIN_PASSWORD:
        token = create_access_token({"sub": username, "role": "admin"})
        return {"access_token": token, "token_type": "bearer"}
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials"
    )

@app.post("/auth/token")
async def create_user_token(user_data: dict):
    """Create token for API users"""
    user_id = user_data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    
    token = create_access_token({"sub": user_id, "role": "user"})
    return {"access_token": token, "token_type": "bearer"}

# Admin endpoints for configuration
@app.get("/admin/config")
async def get_config(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current rate limiting configuration"""
    payload = verify_jwt_token(credentials.credentials)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    config = await redis_client.get("rate_limit_config")
    if config:
        return json.loads(config)
    
    return settings.DEFAULT_RATE_LIMITS

@app.post("/admin/config")
async def update_config(config_data: dict, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Update rate limiting configuration"""
    payload = verify_jwt_token(credentials.credentials)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate config structure
    required_fields = ["default_requests_per_minute", "endpoints"]
    for field in required_fields:
        if field not in config_data:
            raise HTTPException(status_code=400, detail=f"Missing field: {field}")
    
    # Store configuration in Redis
    await redis_client.set("rate_limit_config", json.dumps(config_data))
    
    # Update rate limiter configuration
    await rate_limiter.update_config(config_data)
    
    return {"message": "Configuration updated successfully"}

@app.get("/admin/stats")
async def get_stats(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get rate limiting statistics"""
    payload = verify_jwt_token(credentials.credentials)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    stats = await rate_limiter.get_stats()
    return stats

@app.get("/admin/user/{user_id}/stats")
async def get_user_stats(user_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get rate limiting statistics for a specific user"""
    payload = verify_jwt_token(credentials.credentials)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    stats = await rate_limiter.get_user_stats(user_id)
    return stats

# API proxy endpoints (examples)
@app.get("/api/users")
async def get_users():
    """Example API endpoint - Get users"""
    # Simulate API response
    await asyncio.sleep(0.1)
    return {
        "users": [
            {"id": 1, "name": "John Doe", "email": "john@example.com"},
            {"id": 2, "name": "Jane Smith", "email": "jane@example.com"}
        ]
    }

@app.post("/api/users")
async def create_user(user_data: dict):
    """Example API endpoint - Create user"""
    await asyncio.sleep(0.1)
    return {
        "message": "User created successfully",
        "user": {
            "id": 3,
            "name": user_data.get("name", "Unknown"),
            "email": user_data.get("email", "unknown@example.com")
        }
    }

@app.get("/api/data")
async def get_data():
    """Example API endpoint - Get data"""
    await asyncio.sleep(0.1)
    return {
        "data": [
            {"id": 1, "value": "sample data 1"},
            {"id": 2, "value": "sample data 2"}
        ],
        "timestamp": time.time()
    }

@app.post("/api/data")
async def create_data(data: dict):
    """Example API endpoint - Create data"""
    await asyncio.sleep(0.1)
    return {
        "message": "Data created successfully",
        "data": {
            "id": 10,
            "value": data.get("value", "default value"),
            "created_at": time.time()
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)