from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.routes.api import router as api_router
from backend.routes.pages import router as pages_router
from backend.utils.paths import BASE_DIR

app = FastAPI(title="Intrinsic Value Dashboard API", version="1.0.0")

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