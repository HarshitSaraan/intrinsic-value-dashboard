from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from backend.routes.api import router as api_router
from backend.routes.pages import router as pages_router
from backend.utils.paths import BASE_DIR

app = FastAPI(title="Intrinsic Value Dashboard API", version="1.0.0")


# --- Middleware to allow iframe embedding from any domain ---
class IframeEmbedMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        # Allow embedding in iframes from any domain
        response.headers["Content-Security-Policy"] = "frame-ancestors *"
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
        # Remove X-Frame-Options if present
        if "X-Frame-Options" in response.headers:
            del response.headers["X-Frame-Options"]
        return response


app.add_middleware(IframeEmbedMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve logo and other static images from the frontend/assets folder.
app.mount("/static", StaticFiles(directory=BASE_DIR / "frontend" / "assets"), name="static")

# New modular frontend path for incremental migration.
frontend_dir = BASE_DIR / "frontend"
if frontend_dir.exists():
    app.mount("/frontend", StaticFiles(directory=frontend_dir), name="frontend")
    app.mount("/css", StaticFiles(directory=frontend_dir / "css"), name="css")
    app.mount("/js", StaticFiles(directory=frontend_dir / "js"), name="js")
    app.mount("/assets", StaticFiles(directory=frontend_dir / "assets"), name="assets")

app.include_router(pages_router)
app.include_router(api_router)