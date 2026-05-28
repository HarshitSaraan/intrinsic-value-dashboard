from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import csv as csv_module

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR        = Path(__file__).resolve().parent.parent
CSV_PATH        = BASE_DIR / "stock_master.csv"
DASHBOARD_PATH  = BASE_DIR / "dashboard_master.html"
HW_HISTORY_PATH = BASE_DIR / "headwind_tailwind_history.csv"

# ── Single app instance ────────────────────────────────────────────────────
app = FastAPI(title="Intrinsic Value Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=BASE_DIR), name="static")


# ── Utility helpers ────────────────────────────────────────────────────────

def pick_column(frame: pd.DataFrame, *candidates: str) -> str | None:
    lowered = {str(column).strip().lower(): column for column in frame.columns}
    for candidate in candidates:
        column = lowered.get(candidate.strip().lower())
        if column is not None:
            return column
    return None


def number_or_none(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, str):
        value = value.replace(",", "").replace("%", "").strip()
        if not value:
            return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if pd.isna(number):
        return None
    return round(number, 2)


def clean_text(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    return str(value).strip()


def safe_average(series: pd.Series) -> float | None:
    numeric = pd.to_numeric(series, errors="coerce").dropna()
    if numeric.empty:
        return None
    return round(float(numeric.mean()), 2)


# ── Turnaround score ───────────────────────────────────────────────────────

def compute_turnaround_score(
    promoter_change: float | None,
    revenue_growth: float | None,
    roce: float | None,
    pb: float | None,
    debt_reduction: float | None,
) -> float:
    score = 50.0
    if promoter_change is not None:
        score += max(min(promoter_change * 6.0, 18.0), -18.0)
    if revenue_growth is not None:
        score += max(min(revenue_growth * 0.45, 12.0), -12.0)
    if roce is not None:
        score += max(min((roce - 12.0) * 0.6, 12.0), -12.0)
    if pb is not None:
        score += max(min((2.5 - pb) * 5.5, 10.0), -10.0)
    if debt_reduction is not None:
        score += max(min(debt_reduction * 0.8, 10.0), -10.0)
    return round(max(0.0, min(score, 100.0)), 1)


def build_commentary(record: dict[str, Any]) -> str:
    if record.get("commentary"):
        return record["commentary"]

    notes: list[str] = []
    promoter_change = record.get("promoterHoldingChange")
    pb              = record.get("pb")
    roce            = record.get("roce")
    revenue_growth  = record.get("revenueGrowth")
    debt_reduction  = record.get("debtReduction")

    if promoter_change is not None:
        if promoter_change > 0:
            notes.append(f"promoter support improved by {promoter_change:.2f}%")
        elif promoter_change < 0:
            notes.append(f"promoter ownership eased by {abs(promoter_change):.2f}%")
    if pb is not None and pb <= 1.5:
        notes.append(f"valuations remain contained at {pb:.2f}x book")
    elif pb is not None and pb >= 4:
        notes.append(f"the pocket is already pricing in a strong recovery at {pb:.2f}x book")
    if roce is not None:
        if roce >= 18:
            notes.append(f"ROCE is healthy at {roce:.2f}%")
        elif roce <= 10:
            notes.append(f"capital efficiency still needs work with ROCE at {roce:.2f}%")
    if revenue_growth is not None:
        if revenue_growth >= 12:
            notes.append(f"revenue momentum is running at {revenue_growth:.2f}%")
        elif revenue_growth <= 0:
            notes.append("revenue growth remains soft")
    if debt_reduction is not None and debt_reduction > 0:
        notes.append(f"debt reduction trend reads {debt_reduction:.2f}%")

    if not notes:
        return "Mixed signals for now; monitor balance-sheet repair and earnings follow-through."
    sentence = "; ".join(notes)
    return sentence[:1].upper() + sentence[1:] + "."


# ── Turnaround sectors ─────────────────────────────────────────────────────

def normalize_direct_sector_rows(frame: pd.DataFrame) -> list[dict[str, Any]]:
    sector_col = pick_column(frame, "Sector", "Industry", "Industry Group")
    if sector_col is None:
        return []

    pe_col           = pick_column(frame, "PE", "P/E", "Price to earnings", "Price to Earnings")
    pb_col           = pick_column(frame, "PB", "P/B", "Price to book value", "Price to Book Value", "Price to Book")
    roce_col         = pick_column(frame, "ROCE", "Average return on capital employed 3Years", "Average ROCE 3Years", "Average ROCE 3 Years")
    promoter_col     = pick_column(frame, "PromoterHoldingChange", "Change in promoter holding", "Change in promoter holding 3Years")
    debt_col         = pick_column(frame, "DebtReduction", "Debt Reduction")
    revenue_col      = pick_column(frame, "RevenueGrowth", "Sales growth 3Years", "Sales Growth 3Years")
    commentary_col   = pick_column(frame, "Commentary", "Insights", "Comment")
    tailwind_col     = pick_column(frame, "TailwindScore", "Tailwind Indicator", "Tailwind")

    records: list[dict[str, Any]] = []
    for _, row in frame.iterrows():
        sector_name = clean_text(row.get(sector_col))
        if not sector_name:
            continue
        record = {
            "sector":               sector_name,
            "pe":                   number_or_none(row.get(pe_col))       if pe_col       else None,
            "pb":                   number_or_none(row.get(pb_col))       if pb_col       else None,
            "roce":                 number_or_none(row.get(roce_col))     if roce_col     else None,
            "promoterHoldingChange":number_or_none(row.get(promoter_col)) if promoter_col else None,
            "debtReduction":        number_or_none(row.get(debt_col))     if debt_col     else None,
            "revenueGrowth":        number_or_none(row.get(revenue_col))  if revenue_col  else None,
            "tailwindScore":        number_or_none(row.get(tailwind_col)) if tailwind_col else None,
            "commentary":           clean_text(row.get(commentary_col))   if commentary_col else "",
            "companyCount":         1,
        }
        record["turnaroundScore"] = compute_turnaround_score(
            record["promoterHoldingChange"], record["revenueGrowth"],
            record["roce"], record["pb"], record["debtReduction"],
        )
        if record["tailwindScore"] is None:
            record["tailwindScore"] = record["turnaroundScore"]
        record["commentary"] = build_commentary(record)
        records.append(record)
    return records


def aggregate_company_rows(frame: pd.DataFrame) -> list[dict[str, Any]]:
    sector_col  = pick_column(frame, "Sector", "Industry", "Industry Group")
    if sector_col is None:
        return []

    company_col  = pick_column(frame, "Name", "Company Name", "companyName")
    pe_col       = pick_column(frame, "PE", "P/E", "Price to earnings", "Price to Earnings")
    pb_col       = pick_column(frame, "PB", "P/B", "Price to book value", "Price to Book Value", "Price to Book")
    roce_col     = pick_column(frame, "ROCE", "Average return on capital employed 3Years", "Average ROCE 3Years", "Average ROCE 3 Years")
    promoter_col = pick_column(frame, "PromoterHoldingChange", "Change in promoter holding", "Change in promoter holding 3Years")
    debt_col     = pick_column(frame, "DebtReduction", "Debt Reduction")
    revenue_col  = pick_column(frame, "RevenueGrowth", "Sales growth 3Years", "Sales Growth 3Years")

    records: list[dict[str, Any]] = []
    for sector_name, group in frame.groupby(sector_col, dropna=True):
        sector_label = clean_text(sector_name)
        if not sector_label:
            continue
        record = {
            "sector":                sector_label,
            "pe":                    safe_average(group[pe_col])       if pe_col       else None,
            "pb":                    safe_average(group[pb_col])       if pb_col       else None,
            "roce":                  safe_average(group[roce_col])     if roce_col     else None,
            "promoterHoldingChange": safe_average(group[promoter_col]) if promoter_col else None,
            "debtReduction":         safe_average(group[debt_col])     if debt_col     else None,
            "revenueGrowth":         safe_average(group[revenue_col])  if revenue_col  else None,
            "companyCount":          int(group[company_col].notna().sum()) if company_col else int(len(group)),
        }
        record["turnaroundScore"] = compute_turnaround_score(
            record["promoterHoldingChange"], record["revenueGrowth"],
            record["roce"], record["pb"], record["debtReduction"],
        )
        record["tailwindScore"] = record["turnaroundScore"]
        record["commentary"]    = build_commentary(record)
        records.append(record)
    return records


def load_turnaround_sectors() -> dict[str, Any]:
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail=f"CSV file not found: {CSV_PATH.name}")

    frame = pd.read_csv(CSV_PATH)
    if frame.empty:
        return {
            "source": CSV_PATH.name,
            "generatedAt":  datetime.now(timezone.utc).isoformat(),
            "lastModified": datetime.fromtimestamp(CSV_PATH.stat().st_mtime, tz=timezone.utc).isoformat(),
            "count": 0,
            "data":  [],
        }

    direct_rows  = normalize_direct_sector_rows(frame)
    sector_rows  = direct_rows
    sector_column = pick_column(frame, "Sector")
    if sector_column is None or frame[sector_column].nunique(dropna=True) > max(1, len(frame) // 2):
        aggregated_rows = aggregate_company_rows(frame)
        if aggregated_rows:
            sector_rows = aggregated_rows

    sector_rows = sorted(
        sector_rows,
        key=lambda item: (
            -(item.get("turnaroundScore") or 0),
            -(item.get("tailwindScore")   or 0),
             (item.get("sector")          or ""),
        ),
    )

    return {
        "source":       CSV_PATH.name,
        "generatedAt":  datetime.now(timezone.utc).isoformat(),
        "lastModified": datetime.fromtimestamp(CSV_PATH.stat().st_mtime, tz=timezone.utc).isoformat(),
        "count":        len(sector_rows),
        "data":         sector_rows,
    }


# ── Headwind / Tailwind ────────────────────────────────────────────────────

def compute_headwind_tailwind() -> dict[str, Any]:
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail=f"CSV file not found: {CSV_PATH.name}")

    frame = pd.read_csv(CSV_PATH)

    change_col   = pick_column(frame, "Change in promoter holding")
    industry_col = pick_column(frame, "Industry", "Industry Group", "Sector")

    if change_col is None:
        raise HTTPException(status_code=422, detail="Column 'Change in promoter holding' not found in CSV.")

    numeric_change = pd.to_numeric(
        frame[change_col].astype(str).str.replace(",", "").str.replace("%", "").str.strip(),
        errors="coerce",
    )

    # Movers only (non-zero, non-null) for inc/dec counts
    valid_mask     = numeric_change.notna() & (numeric_change != 0)
    valid          = numeric_change[valid_mask]
    increase_count = int((valid > 0).sum())
    decrease_count = int((valid < 0).sum())
    total_count    = increase_count + decrease_count

    # Market-level score: (inc - dec) / ALL companies
    total_companies = int(len(frame))
    if total_companies == 0:
        score: float | None = None
        score_display = "—"
    else:
        score         = score = round((increase_count/decrease_count), 4)
        score_display = str(score)

    signal = "Tailwind" if (score is not None and score > 1) else \
             "Headwind" if (score is not None and score < 1) else "Neutral"

    # Sector-wise breakdown
    sector_breakdown: list[dict[str, Any]] = []
    if industry_col is not None:
        combined = frame[[industry_col]].copy()
        combined["_change"] = numeric_change

        # Total companies per sector including blanks/zeros
        sector_total_map    = frame[industry_col].value_counts(dropna=False).to_dict()
        combined_filtered   = combined[valid_mask].copy()

        for sector_name, group in combined_filtered.groupby(industry_col, dropna=True):
            s_inc             = int((group["_change"] > 0).sum())
            s_dec             = int((group["_change"] < 0).sum())
            s_total_companies = sector_total_map.get(sector_name, len(group))

            if s_total_companies == 0:
                s_score: float | None = None
                s_score_display = "—"
                s_signal        = "Neutral"
            else:
                s_score         = round((s_inc - s_dec) / s_total_companies, 4)
                s_score_display = str(s_score)
                s_signal        = "Tailwind" if s_score > 0 else ("Headwind" if s_score < 0 else "Neutral")

            sector_breakdown.append({
                "industry":      clean_text(sector_name),
                "increaseCount": s_inc,
                "decreaseCount": s_dec,
                "totalCount":    s_total_companies,
                "score":         s_score,
                "scoreDisplay":  s_score_display,
                "signal":        s_signal,
            })

        sector_breakdown.sort(
            key=lambda x: (x["score"] if x["score"] is not None else float("-inf")),
            reverse=True,
        )

    return {
        "source":       CSV_PATH.name,
        "generatedAt":  datetime.now(timezone.utc).isoformat(),
        "column":       change_col,
        "market": {
            "increaseCount": increase_count,
            "decreaseCount": decrease_count,
            "totalCount":    total_count,
            "score":         score,
            "scoreDisplay":  score_display,
            "signal":        signal,
        },
        "sectorBreakdown": sector_breakdown,
    }


# ── Headwind history ───────────────────────────────────────────────────────

def load_headwind_history() -> dict[str, Any]:
    if not HW_HISTORY_PATH.exists():
        raise HTTPException(status_code=404, detail="headwind_tailwind_history.csv not found")

    rows: list[dict[str, Any]] = []
    with open(HW_HISTORY_PATH, newline="", encoding="utf-8") as f:
        reader = csv_module.DictReader(f)
        for row in reader:
            rows.append(dict(row))

    return {
        "source":      HW_HISTORY_PATH.name,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "data":        rows,
    }


# ── Ranking ────────────────────────────────────────────────────────────────

def compute_ranking(
    search:    str        = "",
    industry:  str        = "",
    min_mcap:  float | None = None,
    max_mcap:  float | None = None,
    top_n:     int        = 0,
) -> dict[str, Any]:
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail=f"CSV file not found: {CSV_PATH.name}")

    frame = pd.read_csv(CSV_PATH)

    name_col     = pick_column(frame, "Name", "Company Name")
    bse_col      = pick_column(frame, "BSE Code")
    nse_col      = pick_column(frame, "NSE Code")
    industry_col = pick_column(frame, "Industry", "Industry Group")
    sector_col   = pick_column(frame, "Sector")
    mcap_col     = pick_column(frame, "Market Capitalization", "Market Cap")
    sales_col    = pick_column(frame, "Sales growth 3Years", "Sales Growth 3Years")
    roce_col     = pick_column(frame, "Average return on capital employed 3Years", "Average ROCE 3Years")
    pb_col       = pick_column(frame, "Price to book value", "Price to Book Value")

    def to_num(series: pd.Series) -> pd.Series:
        return pd.to_numeric(
            series.astype(str).str.replace(",", "").str.replace("%", "").str.strip(),
            errors="coerce",
        )

    df = pd.DataFrame()
    df["name"]     = frame[name_col].apply(clean_text)     if name_col     else ""
    df["bseCode"]  = frame[bse_col].apply(clean_text)      if bse_col      else ""
    df["nseCode"]  = frame[nse_col].apply(clean_text)      if nse_col      else ""
    df["industry"] = frame[industry_col].apply(clean_text) if industry_col else ""
    df["sector"]   = frame[sector_col].apply(clean_text)   if sector_col   else ""
    df["mcap"]     = to_num(frame[mcap_col])               if mcap_col     else float("nan")
    df["sales3Y"]  = to_num(frame[sales_col])              if sales_col    else float("nan")
    df["roce3Y"]   = to_num(frame[roce_col])               if roce_col     else float("nan")
    df["pb"]       = to_num(frame[pb_col])                 if pb_col       else float("nan")

    df = df[df["name"] != ""].copy()

    if search:
        s    = search.lower()
        mask = (
            df["name"].str.lower().str.contains(s, na=False)     |
            df["nseCode"].str.lower().str.contains(s, na=False)  |
            df["bseCode"].str.lower().str.contains(s, na=False)  |
            df["industry"].str.lower().str.contains(s, na=False) |
            df["sector"].str.lower().str.contains(s, na=False)
        )
        df = df[mask].copy()

    if industry:
        df = df[df["industry"] == industry].copy()
    if min_mcap is not None:
        df = df[df["mcap"].notna() & (df["mcap"] >= min_mcap)].copy()
    if max_mcap is not None:
        df = df[df["mcap"].notna() & (df["mcap"] <= max_mcap)].copy()

    if df.empty:
        return {
            "source":        CSV_PATH.name,
            "generatedAt":   datetime.now(timezone.utc).isoformat(),
            "totalCompanies": 0,
            "industries":    [],
            "bestRanked":    None,
            "data":          [],
        }

    missing_rank = len(df) + 1

    def assign_rank(series: pd.Series, ascending: bool) -> pd.Series:
        ranked = series.rank(method="min", ascending=ascending, na_option="keep")
        return ranked.fillna(missing_rank).astype(int)

    df["salesRank"]  = assign_rank(df["sales3Y"], ascending=False)
    df["roceRank"]   = assign_rank(df["roce3Y"],  ascending=False)
    df["pbRank"]     = assign_rank(df["pb"],       ascending=True)
    df["totalScore"] = df["salesRank"] + df["roceRank"] + df["pbRank"]

    df       = df.sort_values(["totalScore", "name"], ascending=[True, True]).reset_index(drop=True)
    df["rank"] = df.index + 1

    if top_n > 0:
        df = df.head(top_n)

    def fmt(v: Any) -> float | None:
        if pd.isna(v):
            return None
        return round(float(v), 2)

    records = [
        {
            "rank":       int(row["rank"]),
            "name":       row["name"],
            "bseCode":    row["bseCode"],
            "nseCode":    row["nseCode"],
            "industry":   row["industry"],
            "sector":     row["sector"],
            "mcap":       fmt(row["mcap"]),
            "sales3Y":    fmt(row["sales3Y"]),
            "roce3Y":     fmt(row["roce3Y"]),
            "pb":         fmt(row["pb"]),
            "salesRank":  int(row["salesRank"]),
            "roceRank":   int(row["roceRank"]),
            "pbRank":     int(row["pbRank"]),
            "totalScore": int(row["totalScore"]),
        }
        for _, row in df.iterrows()
    ]

    return {
        "source":         CSV_PATH.name,
        "generatedAt":    datetime.now(timezone.utc).isoformat(),
        "totalCompanies": len(records),
        "industries":     sorted(frame[industry_col].dropna().astype(str).str.strip().unique().tolist()) if industry_col else [],
        "bestRanked":     records[0]["name"] if records else None,
        "data":           records,
    }


# ── Routes ─────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def dashboard() -> FileResponse:
    if not DASHBOARD_PATH.exists():
        raise HTTPException(status_code=404, detail="dashboard_master.html not found")
    return FileResponse(DASHBOARD_PATH)

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/turnaround-sectors")
async def turnaround_sectors() -> dict[str, Any]:
    return load_turnaround_sectors()

@app.get("/headwind-tailwind")
async def headwind_tailwind() -> dict[str, Any]:
    return compute_headwind_tailwind()

@app.get("/headwind-history")
async def headwind_history() -> dict[str, Any]:
    return load_headwind_history()

@app.get("/ranking")
async def ranking_endpoint(
    search:   str         = "",
    industry: str         = "",
    min_mcap: float | None = None,
    max_mcap: float | None = None,
    top_n:    int         = 0,
) -> dict[str, Any]:
    return compute_ranking(search=search, industry=industry, min_mcap=min_mcap, max_mcap=max_mcap, top_n=top_n)

@app.get("/ranking/industries")
async def ranking_industries() -> dict[str, Any]:
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail=f"CSV file not found: {CSV_PATH.name}")
    frame        = pd.read_csv(CSV_PATH)
    industry_col = pick_column(frame, "Industry", "Industry Group")
    if industry_col is None:
        return {"industries": []}
    return {"industries": sorted(frame[industry_col].dropna().astype(str).str.strip().unique().tolist())}