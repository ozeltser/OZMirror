# Security Requirements

This document outlines critical security requirements that **MUST** be implemented in all OzMirror services.

## Critical Security Issues to Address

### 1. WebSocket Bridge - Redis Publishing Validation

**Issue**: WebSocket bridge must not allow unrestricted Redis publishing without validation.

**Requirements**:
- Implement input validation for all messages before publishing to Redis
- Whitelist allowed message types and validate message structure
- Sanitize all user input to prevent injection attacks
- Add rate limiting to prevent abuse
- Implement message size limits

**Example Implementation**:
```typescript
// Validate message before publishing
function validateMessage(message: any): boolean {
  const allowedTypes = ['module.update', 'config.change', 'layout.update'];

  if (!message.type || !allowedTypes.includes(message.type)) {
    return false;
  }

  // Validate message structure
  if (!message.payload || typeof message.payload !== 'object') {
    return false;
  }

  // Size limit check
  const size = JSON.stringify(message).length;
  if (size > 1024 * 100) { // 100KB limit
    return false;
  }

  return true;
}
```

### 2. Configuration Service - Authentication & Authorization

**Issue**: Configuration endpoints lack authentication and authorization controls.

**Requirements**:
- Implement API key authentication for all endpoints
- Add role-based access control (RBAC) if needed
- Validate API_KEY from environment variables
- Use secure comparison to prevent timing attacks
- Log all authentication failures

**Example Implementation**:
```python
from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Security(api_key_header)):
    expected_key = os.getenv("API_KEY")
    if not expected_key:
        raise HTTPException(status_code=500, detail="API key not configured")

    # Use secure comparison to prevent timing attacks
    import secrets
    if not secrets.compare_digest(api_key, expected_key):
        raise HTTPException(status_code=401, detail="Invalid API key")

    return api_key

# Use in routes
@app.get("/api/config", dependencies=[Security(verify_api_key)])
async def get_config():
    # Protected endpoint
    pass
```

### 3. Memory Leak - Unsubscribe Method

**Issue**: Event handlers accumulate indefinitely in unsubscribe() method, causing memory leaks.

**Requirements**:
- Properly remove event listeners when unsubscribing
- Use WeakMap or WeakSet for handler storage if appropriate
- Implement cleanup on disconnect
- Monitor memory usage in production

**Example Implementation**:
```typescript
class RedisSubscriber {
  private handlers: Map<string, Set<Function>> = new Map();

  subscribe(channel: string, handler: Function) {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);
  }

  unsubscribe(channel: string, handler: Function) {
    const channelHandlers = this.handlers.get(channel);
    if (channelHandlers) {
      channelHandlers.delete(handler);

      // Clean up empty channel sets
      if (channelHandlers.size === 0) {
        this.handlers.delete(channel);
      }
    }
  }

  unsubscribeAll(channel?: string) {
    if (channel) {
      this.handlers.delete(channel);
    } else {
      this.handlers.clear();
    }
  }
}
```

### 4. Docker Images - Production Dependencies

**Issue**: Production Docker images should not include unnecessary dev dependencies.

**Status**: ✅ **FIXED** - Multi-stage builds implemented in:
- `services/websocket/Dockerfile`
- `modules/clock/Dockerfile`

**Implementation**:
- Build stage: Install all dependencies and build TypeScript
- Production stage: Install only production dependencies and copy built files

### 5. CORS Configuration

**Issue**: CORS configuration is invalid or missing, creating security vulnerabilities.

**Requirements**:
- Configure CORS properly in all services
- Use environment variable `ALLOWED_ORIGINS` for allowed origins
- Never use wildcard (`*`) in production
- Include credentials support if needed
- Validate origin against whitelist

**Example Implementation (FastAPI)**:
```python
from fastapi.middleware.cors import CORSMiddleware
import os

# Get allowed origins from environment
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Never use ["*"] in production
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

**Example Implementation (Express)**:
```typescript
import cors from 'cors';

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

## Security Checklist for Implementation

Before marking any service as complete, ensure:

- [ ] All endpoints are authenticated (except public health checks)
- [ ] Input validation is implemented for all user inputs
- [ ] CORS is properly configured with specific origins
- [ ] Rate limiting is in place for public endpoints
- [ ] Memory leaks are prevented (proper cleanup of listeners)
- [ ] Secrets are loaded from environment variables, never hardcoded
- [ ] Docker images use multi-stage builds (production only has runtime deps)
- [ ] Error messages don't leak sensitive information
- [ ] Logging doesn't include sensitive data (passwords, API keys)
- [ ] Dependencies are regularly updated for security patches

## Environment Variables

All services must support these security-related environment variables:

- `API_KEY` - API authentication key
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
- `REDIS_PASSWORD` - Redis authentication password
- `LOG_LEVEL` - Logging level (info, debug, error)

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
