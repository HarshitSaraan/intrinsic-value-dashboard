from __future__ import annotations

from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException

from backend.services.analytics import (
    compute_headwind_tailwind,
    compute_ranking,
    load_headwind_history,
    load_turnaround_sectors,
    pick_column,
)
from backend.utils.paths import CSV_PATH

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/turnaround-sectors")
async def turnaround_sectors() -> dict[str, Any]:
    return load_turnaround_sectors()


@router.get("/headwind-tailwind")
async def headwind_tailwind() -> dict[str, Any]:
    return compute_headwind_tailwind()


@router.get("/headwind-history")
async def headwind_history() -> dict[str, Any]:
    return load_headwind_history()


@router.get("/ranking")
async def ranking_endpoint(
    search: str = "",
    industry: str = "",
    min_mcap: float | None = None,
    max_mcap: float | None = None,
    top_n: int = 0,
) -> dict[str, Any]:
    return compute_ranking(
        search=search,
        industry=industry,
        min_mcap=min_mcap,
        max_mcap=max_mcap,
        top_n=top_n,
    )


@router.get("/ranking/industries")
async def ranking_industries() -> dict[str, Any]:
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail=f"CSV file not found: {CSV_PATH.name}")
    frame = pd.read_csv(CSV_PATH)
    industry_col = pick_column(frame, "Industry", "Industry Group")
    if industry_col is None:
        return {"industries": []}
    return {"industries": sorted(frame[industry_col].dropna().astype(str).str.strip().unique().tolist())}
