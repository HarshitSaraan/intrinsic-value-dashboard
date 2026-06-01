from __future__ import annotations

import csv as csv_module
from datetime import datetime, timezone
from typing import Any

import pandas as pd
from fastapi import HTTPException

from backend.utils.paths import CSV_PATH, HW_HISTORY_PATH


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
    pb = record.get("pb")
    roce = record.get("roce")
    revenue_growth = record.get("revenueGrowth")
    debt_reduction = record.get("debtReduction")

    if promoter_change is not None:
        if promoter_change > 0:
            notes.append(f"promoter support improved by {promoter_change:.2f}%")
        elif promoter_change < 0:
            notes.append(f"promoter ownership eased by {abs(promoter_change):.2f}%")
    if pb is not None and pb <= 1.5:
        notes.append(f"valuations remain contained at {pb:.2f}x book")
    elif pb is not None and pb >= 4:
        notes.append(
            f"the pocket is already pricing in a strong recovery at {pb:.2f}x book"
        )
    if roce is not None:
        if roce >= 18:
            notes.append(f"ROCE is healthy at {roce:.2f}%")
        elif roce <= 10:
            notes.append(
                f"capital efficiency still needs work with ROCE at {roce:.2f}%"
            )
    if revenue_growth is not None:
        if revenue_growth >= 12:
            notes.append(f"revenue momentum is running at {revenue_growth:.2f}%")
        elif revenue_growth <= 0:
            notes.append("revenue growth remains soft")
    if debt_reduction is not None and debt_reduction > 0:
        notes.append(f"debt reduction trend reads {debt_reduction:.2f}%")

    if not notes:
        return (
            "Mixed signals for now; monitor balance-sheet repair and earnings follow-through."
        )
    sentence = "; ".join(notes)
    return sentence[:1].upper() + sentence[1:] + "."


def normalize_direct_sector_rows(frame: pd.DataFrame) -> list[dict[str, Any]]:
    sector_col = pick_column(frame, "Sector", "Industry", "Industry Group")
    if sector_col is None:
        return []

    pe_col = pick_column(frame, "PE", "P/E", "Price to earnings", "Price to Earnings")
    pb_col = pick_column(
        frame,
        "PB",
        "P/B",
        "Price to book value",
        "Price to Book Value",
        "Price to Book",
    )
    roce_col = pick_column(
        frame,
        "ROCE",
        "Average return on capital employed 3Years",
        "Average ROCE 3Years",
        "Average ROCE 3 Years",
    )
    promoter_col = pick_column(
        frame,
        "PromoterHoldingChange",
        "Change in promoter holding",
        "Change in promoter holding 3Years",
    )
    debt_col = pick_column(frame, "DebtReduction", "Debt Reduction")
    revenue_col = pick_column(frame, "RevenueGrowth", "Sales growth 3Years", "Sales Growth 3Years")
    commentary_col = pick_column(frame, "Commentary", "Insights", "Comment")
    tailwind_col = pick_column(frame, "TailwindScore", "Tailwind Indicator", "Tailwind")

    records: list[dict[str, Any]] = []
    for _, row in frame.iterrows():
        sector_name = clean_text(row.get(sector_col))
        if not sector_name:
            continue
        record = {
            "sector": sector_name,
            "pe": number_or_none(row.get(pe_col)) if pe_col else None,
            "pb": number_or_none(row.get(pb_col)) if pb_col else None,
            "roce": number_or_none(row.get(roce_col)) if roce_col else None,
            "promoterHoldingChange": number_or_none(row.get(promoter_col))
            if promoter_col
            else None,
            "debtReduction": number_or_none(row.get(debt_col)) if debt_col else None,
            "revenueGrowth": number_or_none(row.get(revenue_col)) if revenue_col else None,
            "tailwindScore": number_or_none(row.get(tailwind_col)) if tailwind_col else None,
            "commentary": clean_text(row.get(commentary_col)) if commentary_col else "",
            "companyCount": 1,
        }
        record["turnaroundScore"] = compute_turnaround_score(
            record["promoterHoldingChange"],
            record["revenueGrowth"],
            record["roce"],
            record["pb"],
            record["debtReduction"],
        )
        if record["tailwindScore"] is None:
            record["tailwindScore"] = record["turnaroundScore"]
        record["commentary"] = build_commentary(record)
        records.append(record)
    return records


def aggregate_company_rows(frame: pd.DataFrame) -> list[dict[str, Any]]:
    sector_col = pick_column(frame, "Sector", "Industry", "Industry Group")
    if sector_col is None:
        return []

    company_col = pick_column(frame, "Name", "Company Name", "companyName")
    pe_col = pick_column(frame, "PE", "P/E", "Price to earnings", "Price to Earnings")
    pb_col = pick_column(
        frame,
        "PB",
        "P/B",
        "Price to book value",
        "Price to Book Value",
        "Price to Book",
    )
    roce_col = pick_column(
        frame,
        "ROCE",
        "Average return on capital employed 3Years",
        "Average ROCE 3Years",
        "Average ROCE 3 Years",
    )
    promoter_col = pick_column(
        frame,
        "PromoterHoldingChange",
        "Change in promoter holding",
        "Change in promoter holding 3Years",
    )
    debt_col = pick_column(frame, "DebtReduction", "Debt Reduction")
    revenue_col = pick_column(frame, "RevenueGrowth", "Sales growth 3Years", "Sales Growth 3Years")

    records: list[dict[str, Any]] = []
    for sector_name, group in frame.groupby(sector_col, dropna=True):
        sector_label = clean_text(sector_name)
        if not sector_label:
            continue
        record = {
            "sector": sector_label,
            "pe": safe_average(group[pe_col]) if pe_col else None,
            "pb": safe_average(group[pb_col]) if pb_col else None,
            "roce": safe_average(group[roce_col]) if roce_col else None,
            "promoterHoldingChange": safe_average(group[promoter_col]) if promoter_col else None,
            "debtReduction": safe_average(group[debt_col]) if debt_col else None,
            "revenueGrowth": safe_average(group[revenue_col]) if revenue_col else None,
            "companyCount": int(group[company_col].notna().sum()) if company_col else int(len(group)),
        }
        record["turnaroundScore"] = compute_turnaround_score(
            record["promoterHoldingChange"],
            record["revenueGrowth"],
            record["roce"],
            record["pb"],
            record["debtReduction"],
        )
        record["tailwindScore"] = record["turnaroundScore"]
        record["commentary"] = build_commentary(record)
        records.append(record)
    return records


def load_turnaround_sectors() -> dict[str, Any]:
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail=f"CSV file not found: {CSV_PATH.name}")

    frame = pd.read_csv(CSV_PATH)
    if frame.empty:
        return {
            "source": CSV_PATH.name,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "lastModified": datetime.fromtimestamp(CSV_PATH.stat().st_mtime, tz=timezone.utc).isoformat(),
            "count": 0,
            "data": [],
        }

    direct_rows = normalize_direct_sector_rows(frame)
    sector_rows = direct_rows
    sector_column = pick_column(frame, "Sector")
    if sector_column is None or frame[sector_column].nunique(dropna=True) > max(1, len(frame) // 2):
        aggregated_rows = aggregate_company_rows(frame)
        if aggregated_rows:
            sector_rows = aggregated_rows

    sector_rows = sorted(
        sector_rows,
        key=lambda item: (
            -(item.get("turnaroundScore") or 0),
            -(item.get("tailwindScore") or 0),
            (item.get("sector") or ""),
        ),
    )

    return {
        "source": CSV_PATH.name,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "lastModified": datetime.fromtimestamp(CSV_PATH.stat().st_mtime, tz=timezone.utc).isoformat(),
        "count": len(sector_rows),
        "data": sector_rows,
    }


def compute_headwind_tailwind() -> dict[str, Any]:
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail=f"CSV file not found: {CSV_PATH.name}")

    frame = pd.read_csv(CSV_PATH)

    change_col = pick_column(frame, "Change in promoter holding")
    industry_col = pick_column(frame, "Industry", "Industry Group", "Sector")

    if change_col is None:
        raise HTTPException(
            status_code=422,
            detail="Column 'Change in promoter holding' not found in CSV.",
        )

    numeric_change = pd.to_numeric(
        frame[change_col].astype(str).str.replace(",", "").str.replace("%", "").str.strip(),
        errors="coerce",
    )

    valid_mask = numeric_change.notna() & (numeric_change != 0)
    valid = numeric_change[valid_mask]
    increase_count = int((valid > 0).sum())
    decrease_count = int((valid < 0).sum())
    total_count = increase_count + decrease_count

    total_companies = int(len(frame))
    if total_companies == 0:
        score: float | None = None
        score_display = "—"
    else:
        score = round((increase_count / decrease_count), 4)
        score_display = str(score)

    signal = (
        "Tailwind"
        if (score is not None and score > 1)
        else "Headwind"
        if (score is not None and score < 1)
        else "Neutral"
    )

    sector_breakdown: list[dict[str, Any]] = []
    if industry_col is not None:
        combined = frame[[industry_col]].copy()
        combined["_change"] = numeric_change

        sector_total_map = frame[industry_col].value_counts(dropna=False).to_dict()
        combined_filtered = combined[valid_mask].copy()

        for sector_name, group in combined_filtered.groupby(industry_col, dropna=True):
            s_inc = int((group["_change"] > 0).sum())
            s_dec = int((group["_change"] < 0).sum())
            s_total_companies = sector_total_map.get(sector_name, len(group))

            if s_total_companies == 0:
                s_score: float | None = None
                s_score_display = "—"
                s_signal = "Neutral"
            else:
                s_score = round((s_inc - s_dec) / s_total_companies, 4)
                s_score_display = str(s_score)
                s_signal = "Tailwind" if s_score > 0 else ("Headwind" if s_score < 0 else "Neutral")

            sector_breakdown.append(
                {
                    "industry": clean_text(sector_name),
                    "increaseCount": s_inc,
                    "decreaseCount": s_dec,
                    "totalCount": s_total_companies,
                    "score": s_score,
                    "scoreDisplay": s_score_display,
                    "signal": s_signal,
                }
            )

        sector_breakdown.sort(
            key=lambda x: (x["score"] if x["score"] is not None else float("-inf")),
            reverse=True,
        )

    return {
        "source": CSV_PATH.name,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "column": change_col,
        "market": {
            "increaseCount": increase_count,
            "decreaseCount": decrease_count,
            "totalCount": total_count,
            "score": score,
            "scoreDisplay": score_display,
            "signal": signal,
        },
        "sectorBreakdown": sector_breakdown,
    }


def load_headwind_history() -> dict[str, Any]:
    if not HW_HISTORY_PATH.exists():
        raise HTTPException(status_code=404, detail="headwind_tailwind_history.csv not found")

    rows: list[dict[str, Any]] = []
    with open(HW_HISTORY_PATH, newline="", encoding="utf-8") as file_obj:
        reader = csv_module.DictReader(file_obj)
        for row in reader:
            rows.append(dict(row))

    return {
        "source": HW_HISTORY_PATH.name,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "data": rows,
    }


def compute_ranking(
    search: str = "",
    industry: str = "",
    min_mcap: float | None = None,
    max_mcap: float | None = None,
    top_n: int = 0,
) -> dict[str, Any]:
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail=f"CSV file not found: {CSV_PATH.name}")

    frame = pd.read_csv(CSV_PATH)

    name_col = pick_column(frame, "Name", "Company Name")
    bse_col = pick_column(frame, "BSE Code")
    nse_col = pick_column(frame, "NSE Code")
    industry_col = pick_column(frame, "Industry", "Industry Group")
    sector_col = pick_column(frame, "Sector")
    mcap_col = pick_column(frame, "Market Capitalization", "Market Cap")
    sales_col = pick_column(frame, "Sales growth 3Years", "Sales Growth 3Years")
    roce_col = pick_column(frame, "Average return on capital employed 3Years", "Average ROCE 3Years")
    pb_col = pick_column(frame, "Price to book value", "Price to Book Value")

    def to_num(series: pd.Series) -> pd.Series:
        return pd.to_numeric(
            series.astype(str).str.replace(",", "").str.replace("%", "").str.strip(),
            errors="coerce",
        )

    df = pd.DataFrame()
    df["name"] = frame[name_col].apply(clean_text) if name_col else ""
    df["bseCode"] = frame[bse_col].apply(clean_text) if bse_col else ""
    df["nseCode"] = frame[nse_col].apply(clean_text) if nse_col else ""
    df["industry"] = frame[industry_col].apply(clean_text) if industry_col else ""
    df["sector"] = frame[sector_col].apply(clean_text) if sector_col else ""
    df["mcap"] = to_num(frame[mcap_col]) if mcap_col else float("nan")
    df["sales3Y"] = to_num(frame[sales_col]) if sales_col else float("nan")
    df["roce3Y"] = to_num(frame[roce_col]) if roce_col else float("nan")
    df["pb"] = to_num(frame[pb_col]) if pb_col else float("nan")

    df = df[df["name"] != ""].copy()

    if search:
        lowered = search.lower()
        mask = (
            df["name"].str.lower().str.contains(lowered, na=False)
            | df["nseCode"].str.lower().str.contains(lowered, na=False)
            | df["bseCode"].str.lower().str.contains(lowered, na=False)
            | df["industry"].str.lower().str.contains(lowered, na=False)
            | df["sector"].str.lower().str.contains(lowered, na=False)
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
            "source": CSV_PATH.name,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "totalCompanies": 0,
            "industries": [],
            "bestRanked": None,
            "data": [],
        }

    missing_rank = len(df) + 1

    def assign_rank(series: pd.Series, ascending: bool) -> pd.Series:
        ranked = series.rank(method="min", ascending=ascending, na_option="keep")
        return ranked.fillna(missing_rank).astype(int)

    df["salesRank"] = assign_rank(df["sales3Y"], ascending=False)
    df["roceRank"] = assign_rank(df["roce3Y"], ascending=False)
    df["pbRank"] = assign_rank(df["pb"], ascending=True)
    df["totalScore"] = df["salesRank"] + df["roceRank"] + df["pbRank"]

    df = df.sort_values(["totalScore", "name"], ascending=[True, True]).reset_index(drop=True)
    df["rank"] = df.index + 1

    if top_n > 0:
        df = df.head(top_n)

    def fmt(value: Any) -> float | None:
        if pd.isna(value):
            return None
        return round(float(value), 2)

    records = [
        {
            "rank": int(row["rank"]),
            "name": row["name"],
            "bseCode": row["bseCode"],
            "nseCode": row["nseCode"],
            "industry": row["industry"],
            "sector": row["sector"],
            "mcap": fmt(row["mcap"]),
            "sales3Y": fmt(row["sales3Y"]),
            "roce3Y": fmt(row["roce3Y"]),
            "pb": fmt(row["pb"]),
            "salesRank": int(row["salesRank"]),
            "roceRank": int(row["roceRank"]),
            "pbRank": int(row["pbRank"]),
            "totalScore": int(row["totalScore"]),
        }
        for _, row in df.iterrows()
    ]

    return {
        "source": CSV_PATH.name,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "totalCompanies": len(records),
        "industries": sorted(frame[industry_col].dropna().astype(str).str.strip().unique().tolist())
        if industry_col
        else [],
        "bestRanked": records[0]["name"] if records else None,
        "data": records,
    }


def compute_monthly_analysis() -> dict[str, Any]:
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail=f"CSV file not found: {CSV_PATH.name}")

    frame = pd.read_csv(CSV_PATH)
    total_rows = len(frame)

    name_col = pick_column(frame, "Name", "Company Name")
    bse_col = pick_column(frame, "BSE Code")
    nse_col = pick_column(frame, "NSE Code")
    industry_col = pick_column(frame, "Industry", "Industry Group")
    price_col = pick_column(frame, "Current Price", "CMP", "Price")
    mcap_col = pick_column(frame, "Market Capitalization", "Market Cap")
    promoter_col = pick_column(frame, "Promoter holding", "Promoter Holding")
    change_col = pick_column(frame, "Change in promoter holding", "Change in promoter holding 3Years")
    graham_col = pick_column(frame, "Graham Number")
    pb_col = pick_column(frame, "Price to book value", "Price to Book Value", "P/B")
    pc_col = pick_column(frame, "P/C ratio", "PC ratio", "P/C", "PC Ratio", "Price to Cash Flow", "Price to Cashflow")

    def to_num(series: pd.Series) -> pd.Series:
        return pd.to_numeric(
            series.astype(str).str.replace(",", "").str.replace("%", "").str.strip(),
            errors="coerce",
        )

    df = pd.DataFrame()
    df["name"] = frame[name_col].apply(clean_text) if name_col else ""
    df["bseCode"] = frame[bse_col].apply(clean_text) if bse_col else ""
    df["nseCode"] = frame[nse_col].apply(clean_text) if nse_col else ""
    df["industry"] = frame[industry_col].apply(clean_text) if industry_col else ""
    df["currentPrice"] = to_num(frame[price_col]) if price_col else float("nan")
    df["marketCap"] = to_num(frame[mcap_col]) if mcap_col else float("nan")
    df["promoterHolding"] = to_num(frame[promoter_col]) if promoter_col else float("nan")
    df["promoterChange"] = to_num(frame[change_col]) if change_col else float("nan")
    df["grahamNumber"] = to_num(frame[graham_col]) if graham_col else float("nan")
    df["pb"] = to_num(frame[pb_col]) if pb_col else float("nan")
    df["pc"] = to_num(frame[pc_col]) if pc_col else float("nan")

    # Filter rows where grahamNumber > 0 and currentPrice > 0 are valid (finite numbers)
    valid_df = df[
        df["grahamNumber"].notna() & (df["grahamNumber"] > 0) & 
        df["currentPrice"].notna() & (df["currentPrice"] > 0)
    ].copy()

    # Classification
    if not valid_df.empty:
        valid_df["valuationRatio"] = valid_df["grahamNumber"] / valid_df["currentPrice"]
        
        def classify_zone(ratio: float) -> str:
            if ratio > 2:
                return "Extremely Undervalued"
            elif ratio > 1.2:
                return "Undervalued"
            elif ratio >= 0.8:
                return "Fairly Valued"
            elif ratio >= 0.5:
                return "Overvalued"
            else:
                return "Extremely Overvalued"

        valid_df["valuationZone"] = valid_df["valuationRatio"].apply(classify_zone)
    else:
        valid_df["valuationRatio"] = []
        valid_df["valuationZone"] = []

    # Counts
    undervalued_count = int(valid_df["valuationZone"].isin(["Extremely Undervalued", "Undervalued"]).sum())
    overvalued_count = int(valid_df["valuationZone"].isin(["Overvalued", "Extremely Overvalued"]).sum())
    
    if overvalued_count == 0:
        market_ratio = float("inf")
    else:
        market_ratio = round(undervalued_count / overvalued_count, 4)

    # Market Status
    def get_market_status(ratio: float) -> str:
        if ratio > 2:
            return "Extremely Undervalued"
        elif ratio > 1.2:
            return "Undervalued"
        elif ratio >= 0.8:
            return "Fairly Valued"
        elif ratio >= 0.5:
            return "Overvalued"
        else:
            return "Extremely Overvalued"

    status = get_market_status(market_ratio)

    def get_commentary(st: str) -> str:
        if st == "Extremely Overvalued":
            return "The current valuation breadth suggests limited margin of safety across the market. Investors should be selective and avoid chasing momentum."
        elif st == "Overvalued":
            return "Market breadth appears valuation-stretched. Selective stock picking and cash discipline may be important."
        elif st == "Fairly Valued":
            return "The market appears broadly balanced between undervalued and overvalued opportunities."
        elif st == "Undervalued":
            return "Valuation breadth is improving, suggesting a better opportunity set for long-term investors."
        else:
            return "The market shows unusually high valuation comfort based on the available Graham Number framework."

    commentary = get_commentary(status)

    # Distribution chart
    zones = ["Extremely Undervalued", "Undervalued", "Fairly Valued", "Overvalued", "Extremely Overvalued"]
    distribution = []
    for zone in zones:
        count = int((valid_df["valuationZone"] == zone).sum())
        distribution.append({
            "name": zone,
            "count": count
        })

    # Group stats helper
    def get_group_stats(df_source: pd.DataFrame, group_col: str) -> list[dict[str, Any]]:
        stats = []
        for name, group in df_source.groupby(group_col, dropna=True):
            clean_name = str(name).strip()
            if not clean_name:
                continue
            total = len(group)
            if total == 0:
                continue
            undervalued = int(group["valuationZone"].isin(["Extremely Undervalued", "Undervalued"]).sum())
            overvalued = int(group["valuationZone"].isin(["Overvalued", "Extremely Overvalued"]).sum())
            stats.append({
                "name": clean_name,
                "total": total,
                "undervalued": undervalued,
                "overvalued": overvalued,
                "underPct": round((undervalued / total) * 100, 2),
                "overPct": round((overvalued / total) * 100, 2)
            })
        return stats

    # Industry stats
    sector_stats = get_group_stats(valid_df, "industry")
    
    under_sectors = [
        {"name": x["name"], "value": x["underPct"]}
        for x in sector_stats if x["underPct"] > 50
    ]
    under_sectors.sort(key=lambda x: x["value"], reverse=True)
    under_sectors = under_sectors[:15]

    over_sectors = [
        {"name": x["name"], "value": x["overPct"]}
        for x in sector_stats if x["overPct"] > 50
    ]
    over_sectors.sort(key=lambda x: x["value"], reverse=True)
    over_sectors = over_sectors[:15]

    # Market Cap Segment stats
    def segment_name(mcap: float) -> str:
        if pd.isna(mcap) or not math.isfinite(mcap):
            return "Unclassified"
        if mcap < 100:
            return "0–100 Cr"
        elif mcap < 300:
            return "100–300 Cr"
        elif mcap < 1000:
            return "300–1000 Cr"
        elif mcap < 5000:
            return "1000–5000 Cr"
        elif mcap < 20000:
            return "5000–20000 Cr"
        elif mcap < 50000:
            return "20000–50000 Cr"
        else:
            return "Above 50000 Cr"

    import math
    valid_df["segment"] = valid_df["marketCap"].apply(segment_name)
    segment_stats = get_group_stats(valid_df, "segment")

    segment_order = ["0–100 Cr", "100–300 Cr", "300–1000 Cr", "1000–5000 Cr", "5000–20000 Cr", "20000–50000 Cr", "Above 50000 Cr"]
    segment_under = []
    segment_over = []
    for name in segment_order:
        found = next((x for x in segment_stats if x["name"] == name), None)
        segment_under.append({
            "name": name,
            "value": found["underPct"] if found else 0.0
        })
        segment_over.append({
            "name": name,
            "value": found["overPct"] if found else 0.0
        })

    # Count by industry (turnaround / negative turnaround)
    def count_by_industry(df_source: pd.DataFrame, mask_condition: pd.Series) -> list[dict[str, Any]]:
        filtered = df_source[mask_condition].copy()
        counts = filtered["industry"].value_counts(dropna=True).to_dict()
        res = [{"name": str(name).strip(), "count": int(count)} for name, count in counts.items() if str(name).strip()]
        res.sort(key=lambda x: x["count"], reverse=True)
        return res

    turnaround_series = df["promoterChange"].notna() & (df["promoterChange"] > 0)
    negative_turnaround_series = df["promoterChange"].notna() & (df["promoterChange"] < 0)

    turnaround = count_by_industry(df, turnaround_series)
    negative_turnaround = count_by_industry(df, negative_turnaround_series)

    # Top Turnaround Companies grouped by top turnaround industry sectors
    top_turnaround_sectors = [x["name"] for x in turnaround[:5]]
    
    top_companies = []
    missing_pc_count = 0
    
    for sector in top_turnaround_sectors:
        # count how many companies in this sector have promoterChange > 0 but DO NOT have pc > 0
        sector_all = df[(df["industry"] == sector) & (df["promoterChange"].notna()) & (df["promoterChange"] > 0)]
        sector_invalid_pc = sector_all[~(sector_all["pc"].notna() & (sector_all["pc"] > 0))]
        missing_pc_count += len(sector_invalid_pc)
        
        # filter companies in this sector with promoterChange > 0 and pc > 0
        sector_companies = df[(df["industry"] == sector) & (df["promoterChange"].notna()) & (df["promoterChange"] > 0) & (df["pc"].notna()) & (df["pc"] > 0)].copy()
        # sort by pc ascending, select top 3
        sector_companies = sector_companies.sort_values("pc", ascending=True).head(3)
        for _, row in sector_companies.iterrows():
            top_companies.append({
                "industry": row["industry"],
                "name": row["name"],
                "nseCode": row["nseCode"],
                "bseCode": row["bseCode"],
                "promoterChange": round(float(row["promoterChange"]), 2) if pd.notna(row["promoterChange"]) else None,
                "pc": round(float(row["pc"]), 2) if pd.notna(row["pc"]) else None,
                "marketCap": round(float(row["marketCap"]), 2) if pd.notna(row["marketCap"]) else None,
                "currentPrice": round(float(row["currentPrice"]), 2) if pd.notna(row["currentPrice"]) else None
            })

    return {
        "source": CSV_PATH.name,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "totalRows": total_rows,
        "validRows": len(valid_df),
        "firstGraham": round(float(valid_df.iloc[0]["grahamNumber"]), 2) if len(valid_df) > 0 and pd.notna(valid_df.iloc[0]["grahamNumber"]) else None,
        "firstCurrentPrice": round(float(valid_df.iloc[0]["currentPrice"]), 2) if len(valid_df) > 0 and pd.notna(valid_df.iloc[0]["currentPrice"]) else None,
        "undervaluedCount": undervalued_count,
        "overvaluedCount": overvalued_count,
        "marketRatio": "Infinity" if math.isinf(market_ratio) else market_ratio,
        "status": status,
        "commentary": commentary,
        "distribution": distribution,
        "underSectors": under_sectors,
        "overSectors": over_sectors,
        "segmentUnder": segment_under,
        "segmentOver": segment_over,
        "turnaround": turnaround[:15],
        "negativeTurnaround": negative_turnaround[:15],
        "topCompanies": top_companies,
        "missingPcCount": missing_pc_count
    }


def evaluate_portfolio_stock(query: str) -> dict[str, Any]:
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail=f"CSV file not found: {CSV_PATH.name}")

    df = pd.read_csv(CSV_PATH)
    name_col = pick_column(df, "Name", "Company Name")
    bse_col = pick_column(df, "BSE Code")
    nse_col = pick_column(df, "NSE Code")
    isin_col = pick_column(df, "ISIN Code")

    q = query.strip().lower()
    match_row = None

    for col in [nse_col, bse_col, isin_col, name_col]:
      if col:
        temp = df[df[col].astype(str).str.strip().str.lower() == q]
        if not temp.empty:
          match_row = temp.iloc[0]
          break

    if match_row is None:
      for col in [nse_col, bse_col, isin_col, name_col]:
        if col:
          temp = df[df[col].astype(str).str.lower().str.contains(q, na=False)]
          if not temp.empty:
            match_row = temp.iloc[0]
            break

    if match_row is None:
        raise HTTPException(status_code=404, detail=f"Stock not found matching: {query}")

    def get_val(col_name) -> float | None:
        if col_name is None:
            return None
        return number_or_none(match_row.get(col_name))

    def get_fallback_val(col_10, col_5, col_3):
        val = get_val(col_10)
        if val is None:
            val = get_val(col_5)
        if val is None:
            val = get_val(col_3)
        return val

    # FALLBACK LOGIC FOR QUALITY
    bv_10 = pick_column(df, "BOOK VALUE GOWTH 10 YR")
    bv_5 = pick_column(df, "book value growth 5 yrs")
    bv_3 = pick_column(df, "book value growth 3 years")
    bv_growth = get_fallback_val(bv_10, bv_5, bv_3)

    sg_10 = pick_column(df, "Sales growth 10Years")
    sg_5 = pick_column(df, "Sales growth 5years median")
    sg_3 = pick_column(df, "Sales growth 3Years")
    sales_growth = get_fallback_val(sg_10, sg_5, sg_3)

    roce_10 = pick_column(df, "Average return on capital employed 10Years")
    roce_5 = pick_column(df, "Average return on capital employed 5Years")
    roce_3 = pick_column(df, "Average return on capital employed 3Years")
    roce = get_fallback_val(roce_10, roce_5, roce_3)

    icr_col = pick_column(df, "Interest Coverage Ratio")
    icr = get_val(icr_col)

    net_block_col = pick_column(df, "Net block")
    net_block_prev_col = pick_column(df, "Net block preceding year")
    net_block = get_val(net_block_col)
    net_block_prev = get_val(net_block_prev_col)

    q_turnover_col = pick_column(df, "Quality turnover")
    q_turnover = get_val(q_turnover_col)

    # QUALITY SCORING
    q1_score = 0
    if bv_growth is not None:
        if bv_growth > 136: q1_score = 1
        elif bv_growth >= 100: q1_score = 0
        else: q1_score = -1

    q2_score = 0
    if sales_growth is not None:
        if sales_growth > 10: q2_score = 1
        elif sales_growth >= 0: q2_score = 0
        else: q2_score = -1

    q3_score = 0
    if roce is not None:
        if roce > 10: q3_score = 1
        elif roce >= 0: q3_score = 0
        else: q3_score = -1

    q4_score = 0
    if icr is not None:
        if icr > 5: q4_score = 1
        elif icr >= 2: q4_score = 0
        else: q4_score = -1

    q5_score = 0
    net_block_ratio = None
    if net_block is not None and net_block_prev is not None and net_block_prev != 0:
        net_block_ratio = round(net_block / net_block_prev, 2)
        q5_score = 1 if net_block_ratio > 2.0 else 0

    q6_score = 0
    if q_turnover is not None:
        if q_turnover > 0.1:
            q6_score = -1
        elif q_turnover >= 0:
            q6_score = 1
        else:
            q6_score = 0
        
    quality_total = q1_score + q2_score + q3_score + q4_score + q5_score + q6_score

    # MANAGEMENT PARAMETERS
    sh_var_col = pick_column(df, "shareholder Var", "Pft per Inv")
    pledged_col = pick_column(df, "Pledged percentage")
    hold_inv_col = pick_column(df, "Holding per Investor")
    chg_prom_3y_col = pick_column(df, "Change in promoter holding 3Years")
    chg_prom_col = pick_column(df, "Change in promoter holding")

    sh_var = get_val(sh_var_col) if (sh_var_col and "shareholder" in sh_var_col.lower()) else None
    m1_score = 0
    if sh_var is not None:
        if sh_var < 1.2: m1_score = 1
        elif sh_var <= 2.0: m1_score = 0
        else: m1_score = -1

    pledged_val = get_val(pledged_col)
    m2_score = 1
    if pledged_val is not None:
        if pledged_val <= 1.0: m2_score = 1
        else: m2_score = -1

    hold_inv = get_val(hold_inv_col)
    m3_score = 1
    if hold_inv is not None:
        if hold_inv >= 0.02: m3_score = 1
        else: m3_score = -1

    chg_prom_3y = get_val(chg_prom_3y_col)
    m4_score = 0
    if chg_prom_3y is not None:
        if chg_prom_3y > 0.5:
            m4_score = 1
        elif chg_prom_3y >= -0.5:
            m4_score = 0
        elif chg_prom_3y >= -5.0:
            m4_score = -1
        else:
            m4_score = -2

    chg_prom = get_val(chg_prom_col)
    m5_score = 0
    if chg_prom is not None:
        if chg_prom > 0.5:
            m5_score = 1
        elif chg_prom >= -0.5:
            m5_score = 0
        elif chg_prom >= -5.0:
            m5_score = -1
        else:
            m5_score = -2

    management_total = m1_score + m2_score + m3_score + m4_score + m5_score

    # VALUATION PARAMETERS
    
    # 1. Sectoral Average calculations (based on Industry Group / Industry)
    sector_pb = None
    sector_ps = None
    sector_name = "N/A"
    
    ind_col = pick_column(df, "Industry")
    if ind_col:
        sector_name = clean_text(match_row.get(ind_col)) or "N/A"
        if sector_name != "N/A":
            sector_df = df[df[ind_col] == sector_name]
            
            pb_col_name = pick_column(df, "Price to book value")
            if pb_col_name:
                sector_pb_vals = pd.to_numeric(sector_df[pb_col_name], errors='coerce').dropna()
                if not sector_pb_vals.empty:
                    sector_pb = round(float(sector_pb_vals.mean()), 2)
                    
            ps_col_name = pick_column(df, "Price to Sales")
            if ps_col_name:
                sector_ps_vals = pd.to_numeric(sector_df[ps_col_name], errors='coerce').dropna()
                if not sector_ps_vals.empty:
                    sector_ps = round(float(sector_ps_vals.mean()), 2)

    # Valuation parameters scores calculation
    pb_col = pick_column(df, "Price to book value")
    stock_pb = get_val(pb_col)
    v1_score = 0
    if stock_pb is not None and sector_pb is not None:
        v1_score = 1 if stock_pb < sector_pb else 0

    ps_col = pick_column(df, "Price to Sales")
    stock_ps = get_val(ps_col)
    v2_score = 0
    if stock_ps is not None and sector_ps is not None:
        v2_score = 1 if stock_ps < sector_ps else 0

    cmp_val = get_val(pick_column(df, "Current Price"))
    graham_val = get_val(pick_column(df, "Graham Number"))
    v3_score = 0
    if cmp_val is not None and graham_val is not None:
        if cmp_val < graham_val:
            v3_score = 1
        elif cmp_val <= graham_val * 1.5:
            v3_score = 0
        else:
            v3_score = -1

    iv_val = get_val(pick_column(df, "Intrinsic Value"))
    v4_score = 0
    if cmp_val is not None and iv_val is not None:
        if cmp_val < iv_val:
            v4_score = 1
        elif cmp_val <= iv_val * 1.5:
            v4_score = 0
        else:
            v4_score = -1

    # 5. Cash Rich check
    ev_val = get_val(pick_column(df, "Enterprise Value"))
    cash_eq = get_val(pick_column(df, "Cash Equivalents"))
    investments = get_val(pick_column(df, "Investments"))
    mcap_val = get_val(pick_column(df, "Market Capitalization"))
    debt_val = get_val(pick_column(df, "Debt"))

    cash_val = cash_eq if cash_eq is not None else 0.0
    inv_val = investments if investments is not None else 0.0

    v5_score = 0
    if ev_val is not None and ev_val < 0:
        v5_score = 2
    elif mcap_val is not None and (cash_val + inv_val) > 2 * mcap_val and (cash_eq is not None or investments is not None):
        v5_score = 1
    elif debt_val is not None and mcap_val is not None and debt_val > mcap_val:
        v5_score = -1

    valuation_total = v1_score + v2_score + v3_score + v4_score + v5_score

    combined_score = quality_total + management_total
    total_score = quality_total + management_total + valuation_total

    # Final rating logic based on total score (out of 17)
    # above 12 (i.e. >= 13) excellent
    # btw 9-12 Good
    # 5-8 Average
    # below 5 poor
    if total_score >= 13:
        final_rating = "Excellent"
    elif total_score >= 9:
        final_rating = "Good"
    elif total_score >= 5:
        final_rating = "Average"
    else:
        final_rating = "Poor"

    stock_name = clean_text(match_row.get(name_col)) if name_col else ""
    nse_code = clean_text(match_row.get(nse_col)) if nse_col else ""
    bse_code = clean_text(match_row.get(bse_col)) if bse_col else ""

    return {
        "stock": {
            "name": stock_name,
            "nseCode": nse_code,
            "bseCode": bse_code,
            "isinCode": clean_text(match_row.get(isin_col)) if isin_col else ""
        },
        "overall": {
            "combinedScore": combined_score,
            "totalScore": total_score,
            "finalRating": final_rating
        },
        "quality": {
            "score": f"{quality_total}",
            "total": quality_total,
            "parameters": [
                {
                    "name": "Book Value Growth",
                    "value": bv_growth,
                    "displayValue": f"{bv_growth}%" if bv_growth is not None else "N/A",
                    "threshold": "> 136 (1), 100-136 (0), < 100 (-1)",
                    "score": q1_score
                },
                {
                    "name": "Sales Growth",
                    "value": sales_growth,
                    "displayValue": f"{sales_growth}%" if sales_growth is not None else "N/A",
                    "threshold": "> 10 (1), 0-10 (0), < 0 (-1)",
                    "score": q2_score
                },
                {
                    "name": "ROCE",
                    "value": roce,
                    "displayValue": f"{roce}%" if roce is not None else "N/A",
                    "threshold": "> 10 (1), 0-10 (0), < 0 (-1)",
                    "score": q3_score
                },
                {
                    "name": "Interest Coverage Ratio",
                    "value": icr,
                    "displayValue": f"{icr}x" if icr is not None else "N/A",
                    "threshold": "> 5 (1), 2-5 (0), < 2 (-1)",
                    "score": q4_score
                },
                {
                    "name": "Capex (Net Block)",
                    "value": net_block_ratio,
                    "displayValue": f"{net_block_ratio}x" if net_block_ratio is not None else "N/A",
                    "threshold": "> 2 (1), < 2 (0)",
                    "score": q5_score
                },
                {
                    "name": "Quality Turnover",
                    "value": q_turnover,
                    "displayValue": f"{q_turnover}" if q_turnover is not None else "N/A",
                    "threshold": "> 0.1 (1), < 0.1 (0)",
                    "score": q6_score
                }
            ]
        },
        "management": {
            "score": f"{management_total}",
            "total": management_total,
            "parameters": [
                {
                    "name": "Shareholder Variation",
                    "value": sh_var,
                    "displayValue": f"{sh_var}" if sh_var is not None else "N/A",
                    "threshold": "< 1.2 (1), 1.2-2 (0), > 2 (-1)",
                    "score": m1_score
                },
                {
                    "name": "Pledged Percentage",
                    "value": pledged_val,
                    "displayValue": f"{pledged_val}%" if pledged_val is not None else "0% (N/A)",
                    "threshold": "<= 1 (1), > 1 (-1)",
                    "score": m2_score
                },
                {
                    "name": "Holding Investor",
                    "value": hold_inv,
                    "displayValue": f"{hold_inv}" if hold_inv is not None else "N/A",
                    "threshold": ">= 0.02 (1), < 0.02 (-1)",
                    "score": m3_score
                },
                {
                    "name": "Change in Promoter Holding (3 Years)",
                    "value": chg_prom_3y,
                    "displayValue": f"{chg_prom_3y}%" if chg_prom_3y is not None else "N/A",
                    "threshold": "> 0.5 (1), -0.5 to 0.5 (0), -5 to -0.5 (-1), < -5 (-2)",
                    "score": m4_score
                },
                {
                    "name": "Change in Promoter Holding (Quarterly)",
                    "value": chg_prom,
                    "displayValue": f"{chg_prom}%" if chg_prom is not None else "N/A",
                    "threshold": "> 0.5 (1), -0.5 to 0.5 (0), -5 to -0.5 (-1), < -5 (-2)",
                    "score": m5_score
                }
            ]
        },
        "valuation": {
            "score": f"{valuation_total}",
            "total": valuation_total,
            "parameters": [
                {
                    "name": "P/B Ratio vs Sector Average",
                    "value": stock_pb,
                    "displayValue": f"{stock_pb}x (Sector Avg: {sector_pb}x)" if stock_pb is not None and sector_pb is not None else "N/A",
                    "threshold": "P/B < Sector P/B (1), P/B > Sector P/B (0)",
                    "score": v1_score
                },
                {
                    "name": "P/S Ratio vs Sector Average",
                    "value": stock_ps,
                    "displayValue": f"{stock_ps}x (Sector Avg: {sector_ps}x)" if stock_ps is not None and sector_ps is not None else "N/A",
                    "threshold": "P/S < Sector P/S (1), P/S > Sector P/S (0)",
                    "score": v2_score
                },
                {
                    "name": "Current Price vs Graham Number",
                    "value": cmp_val,
                    "displayValue": f"CMP: {cmp_val} (Graham: {graham_val})" if cmp_val is not None and graham_val is not None else "N/A",
                    "threshold": "CMP < Graham (1), Graham <= CMP <= Graham * 1.5 (0), CMP > Graham * 1.5 (-1)",
                    "score": v3_score
                },
                {
                    "name": "Current Price vs Intrinsic Value",
                    "value": cmp_val,
                    "displayValue": f"CMP: {cmp_val} (Intrinsic: {iv_val})" if cmp_val is not None and iv_val is not None else "N/A",
                    "threshold": "CMP < Intrinsic (1), Intrinsic <= CMP <= Intrinsic * 1.5 (0), CMP > Intrinsic * 1.5 (-1)",
                    "score": v4_score
                },
                {
                    "name": "Cash Rich Rating",
                    "value": ev_val,
                    "displayValue": f"EV: {ev_val} (Cash+Inv: {round(cash_val + inv_val, 2)}, Debt: {debt_val}, Mcap: {mcap_val})" if ev_val is not None else "N/A",
                    "threshold": "EV < 0 (+2), Cash+Inv > 2*Mcap (+1), Debt > Mcap (-1), Else (0)",
                    "score": v5_score
                }
            ]
        },
        "remark": ""
    }


def search_stocks(query: str) -> list[dict[str, str]]:
    if not query:
        return []
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail=f"CSV file not found: {CSV_PATH.name}")

    df = pd.read_csv(CSV_PATH)
    name_col = pick_column(df, "Name", "Company Name")
    bse_col = pick_column(df, "BSE Code")
    nse_col = pick_column(df, "NSE Code")
    isin_col = pick_column(df, "ISIN Code")

    q = query.strip().lower()
    mask = pd.Series(False, index=df.index)
    if name_col:
        mask = mask | df[name_col].astype(str).str.lower().str.contains(q, na=False)
    if nse_col:
        mask = mask | df[nse_col].astype(str).str.lower().str.contains(q, na=False)
    if bse_col:
        mask = mask | df[bse_col].astype(str).str.lower().str.contains(q, na=False)
    if isin_col:
        mask = mask | df[isin_col].astype(str).str.lower().str.contains(q, na=False)

    matching_df = df[mask].head(15)

    results = []
    for _, row in matching_df.iterrows():
        results.append({
            "name": clean_text(row.get(name_col)) if name_col else "",
            "nseCode": clean_text(row.get(nse_col)) if nse_col else "",
            "bseCode": clean_text(row.get(bse_col)) if bse_col else "",
            "isinCode": clean_text(row.get(isin_col)) if isin_col else ""
        })
    return results

