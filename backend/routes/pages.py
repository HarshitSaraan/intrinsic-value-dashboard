from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from backend.utils.paths import BASE_DIR

router = APIRouter()
PAGES_DIR = BASE_DIR / "frontend" / "pages"


def _frontend_page(filename: str) -> FileResponse:
    target = PAGES_DIR / filename
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"frontend page not found: {filename}")
    return FileResponse(path=target)


@router.get("/", response_class=HTMLResponse)
async def dashboard_home() -> FileResponse:
    return _frontend_page("dashboard.html")



@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page() -> FileResponse:
    return _frontend_page("dashboard.html")


@router.get("/tools", response_class=HTMLResponse)
async def tools_page() -> FileResponse:
    return _frontend_page("tools.html")


@router.get("/sip", response_class=HTMLResponse)
async def sip_page() -> FileResponse:
    return _frontend_page("sip.html")


@router.get("/swp", response_class=HTMLResponse)
async def swp_page() -> FileResponse:
    return _frontend_page("swp.html")


@router.get("/lumpsum", response_class=HTMLResponse)
async def lumpsum_page() -> FileResponse:
    return _frontend_page("lumpsum.html")


@router.get("/xirr", response_class=HTMLResponse)
async def xirr_page() -> FileResponse:
    return _frontend_page("xirr.html")


@router.get("/gawp", response_class=HTMLResponse)
async def gawp_page() -> FileResponse:
    return _frontend_page("gawp.html")



@router.get("/monthly-market-analysis", response_class=HTMLResponse)
async def monthly_market_analysis_page() -> FileResponse:
    return _frontend_page("monthly-market-analysis.html")


@router.get("/market-valuation-index", response_class=HTMLResponse)
async def market_valuation_index_page() -> FileResponse:
    return _frontend_page("market-valuation-index.html")


@router.get("/headwind-tailwind-indicator", response_class=HTMLResponse)
async def headwind_tailwind_indicator_page() -> FileResponse:
    return _frontend_page("headwind-tailwind-indicator.html")


@router.get("/portfolio-review-tool", response_class=HTMLResponse)
async def portfolio_review_tool_page() -> FileResponse:
    return _frontend_page("portfolio-review-tool.html")


@router.get("/ranking-tool", response_class=HTMLResponse)
async def ranking_tool_page() -> FileResponse:
    return _frontend_page("ranking-tool.html")


@router.get("/strategies", response_class=HTMLResponse)
async def strategies_page() -> FileResponse:
    return _frontend_page("strategies.html")


@router.get("/admin", response_class=HTMLResponse)
async def admin_page() -> FileResponse:
    return _frontend_page("admin.html")





