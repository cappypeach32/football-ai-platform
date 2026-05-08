import time
import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()

# Sources allowed by Content-Security-Policy
_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "   # Next.js requires inline + eval in dev
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob: https://*.espncdn.com https://*.api-sports.io "
    "https://upload.wikimedia.org https://crests.football-data.org; "
    "font-src 'self' data:; "
    "connect-src 'self' ws://localhost:* wss://localhost:* ws: wss:; "
    "frame-ancestors 'none';"
)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration = (time.perf_counter() - start) * 1000
        logger.info(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round(duration, 2),
        )
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        # Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        # Legacy XSS filter (belt-and-suspenders)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # Limit referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Enforce HTTPS for 1 year (only meaningful behind TLS in production)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        # Disable browser features not needed by the app
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
        )
        # Content Security Policy
        response.headers["Content-Security-Policy"] = _CSP
        return response
