from __future__ import annotations

from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, File, UploadFile, Header, Form

from backend.services.analytics import (
    compute_headwind_tailwind,
    compute_monthly_analysis,
    compute_ranking,
    load_headwind_history,
    load_turnaround_sectors,
    pick_column,
    evaluate_portfolio_stock,
    search_stocks,
    compute_ticker_data,
)
from backend.utils.paths import CSV_PATH

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ticker-data")
async def ticker_data() -> dict[str, Any]:
    return compute_ticker_data()



@router.get("/turnaround-sectors")
async def turnaround_sectors() -> dict[str, Any]:
    return load_turnaround_sectors()


@router.get("/headwind-tailwind")
async def headwind_tailwind() -> dict[str, Any]:
    return compute_headwind_tailwind()


@router.get("/headwind-history")
async def headwind_history() -> dict[str, Any]:
    return load_headwind_history()


@router.get("/monthly-analysis")
async def monthly_analysis() -> dict[str, Any]:
    return compute_monthly_analysis()


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
    try:
        from backend.services.analytics import get_stock_master_clean_df
        _, industries = get_stock_master_clean_df()
        return {"industries": industries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/portfolio-search")
async def portfolio_search_endpoint(q: str = "") -> dict[str, Any]:
    return {"results": search_stocks(q)}


@router.get("/portfolio-evaluate")
async def portfolio_evaluate_endpoint(q: str = "") -> dict[str, Any]:
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
    return evaluate_portfolio_stock(q)


SECTOR_VALUATION_CACHE = {
    'mtime': 0,
    'data': None
}


@router.get("/sector-valuation")
async def sector_valuation_endpoint() -> dict[str, Any]:
    import math
    import time
    from backend.utils.paths import SECTOR_DATA_PATH
    
    sector_data_path = SECTOR_DATA_PATH
    if not sector_data_path.exists():
        raise HTTPException(status_code=404, detail="sector_data.csv not found")
        
    try:
        current_mtime = sector_data_path.stat().st_mtime
    except Exception:
        current_mtime = time.time()
        
    global SECTOR_VALUATION_CACHE
    if SECTOR_VALUATION_CACHE['data'] is not None and SECTOR_VALUATION_CACHE['mtime'] == current_mtime:
        return SECTOR_VALUATION_CACHE['data']
        
    df = pd.read_csv(sector_data_path, header=None)
    data_matrix = df.values.tolist()
    row0 = data_matrix[0]
    row1 = data_matrix[1]
    
    current_sector = None
    sector_columns = {}
    for col_idx, (sec, col_type) in enumerate(zip(row0, row1)):
        if pd.notna(sec) and str(sec).strip() != '':
            current_sector = str(sec).strip()
        if current_sector:
            if current_sector not in sector_columns:
                sector_columns[current_sector] = []
            sector_columns[current_sector].append((col_idx, str(col_type).strip()))
            
    exclude_sectors = {'Gold (INR/10gm)', 'Silver (INR/Kg)', 'Oil (USD/Barrel)', 'Sector'}
    sectors = [s for s in sector_columns.keys() if s not in exclude_sectors]
    
    result = {}
    for s in sectors:
        # Check case-insensitively if this is a commodity valuation sector (contains gold/silver and ends with valuation)
        is_commodity_valuation = s.lower().endswith('valuation') and ('gold' in s.lower() or 'silver' in s.lower())
        
        if is_commodity_valuation:
            cols = sector_columns[s]
            pb_col = cols[0][0]  # The valuation column itself holds the PB/Valuation ratio
            
            # Find the index price column by scanning Row 0 for the commodity prefix (e.g. "gold")
            commodity_prefix = s.lower().replace('valuation', '').strip()
            idx_col = None
            for col_idx, sec_name in enumerate(row0):
                if pd.notna(sec_name):
                    sec_str = str(sec_name).strip().lower()
                    if commodity_prefix in sec_str and 'valuation' not in sec_str:
                        idx_col = col_idx
                        break
            pe_col = None
            div_col = None
        else:
            cols = sector_columns[s]
            idx_col = next((c[0] for c in cols if 'index' in c[1].lower() or c[1].lower() == s.lower()), None)
            pe_col = next((c[0] for c in cols if 'p/e' in c[1].lower()), None)
            pb_col = next((c[0] for c in cols if 'p/b' in c[1].lower()), None)
            div_col = next((c[0] for c in cols if 'div' in c[1].lower() or 'yield' in c[1].lower()), None)
        
        series = []
        for r_idx in range(2, len(data_matrix)):
            row_data = data_matrix[r_idx]
            date_val = row_data[0]
            if date_val is None or (isinstance(date_val, float) and math.isnan(date_val)):
                continue
            date = str(date_val).strip()
            if date == '' or date.lower() == 'nan':
                continue
                
            def get_val(col):
                if col is None: return None
                val = row_data[col]
                if val is None or (isinstance(val, float) and math.isnan(val)): return None
                val_str = str(val).replace(',', '').replace('%', '').strip()
                if not val_str or val_str.lower() == 'nan':
                    return None
                try:
                    v = float(val_str)
                    return None if math.isnan(v) else v
                except ValueError:
                    return None
            
            series.append({
                'date': date,
                'index': get_val(idx_col),
                'pe': get_val(pe_col),
                'pb': get_val(pb_col),
                'div_yield': get_val(div_col)
            })
        result[s] = series
        
    response_data = {"sectors": sectors, "data": result}
    SECTOR_VALUATION_CACHE['mtime'] = current_mtime
    SECTOR_VALUATION_CACHE['data'] = response_data
    return response_data



@router.get("/intrinsic-theme-data")
async def intrinsic_theme_endpoint(type: str = "growth-at-value") -> dict[str, Any]:
    from backend.services.analytics import get_stock_master_clean_df
    import pandas as pd
    from typing import Any

    try:
        df, _ = get_stock_master_clean_df()
        if "mcap" in df.columns:
            df = df[df["mcap"] > 300].copy()
    except Exception as e:
        print(f"Error loading clean stock master in intrinsic-theme-data: {e}")
        return {"type": type, "quotes": [], "summary": {}}

    if df.empty:
        return {"type": type, "quotes": [], "summary": {}}

    # Filter stocks based on formula
    if type == "growth-at-value":
        # 1. Growth at Value: Sales Growth 3Years > 20% | Price to Earning between 0 and 25 | Price to Book value < 4.5
        filtered = df[
            (df["sales3Y"] > 20) &
            (df["pe"] > 0) &
            (df["pe"] <= 25) &
            (df["pb"] < 4.5)
        ].copy()
    elif type == "aggressive-smallcaps":
        # 2. High Growth Small Cap: Market Cap < 2000 Cr | Sales Growth 3Years > 25% | ROCE 3Years > 12%
        filtered = df[
            (df["mcap"] < 2000) &
            (df["sales3Y"] > 25) &
            (df["roce3Y"] > 12)
        ].copy()
    elif type == "undervalued-largecaps":
        # 3. Value Large Cap: Market Cap > 15000 Cr | Price to Earning between 0 and 18 | Price to Book value < 3.0
        filtered = df[
            (df["mcap"] > 15000) &
            (df["pe"] > 0) &
            (df["pe"] < 18) &
            (df["pb"] < 3.0)
        ].copy()
    elif type == "growth-tech":
        # 4. Technology Leader: Industry Group contains Software/IT/Telecom/Tech | Sales Growth 3Years > 20%
        tech_mask = df["industryGroup"].fillna("").str.lower().str.contains("software|it -|telecom|tech")
        filtered = df[tech_mask & (df["sales3Y"] > 20)].copy()
    elif type == "portfolio-anchors":
        # 5. Core Compounders: Market Cap > 25000 Cr | Piotroski Score >= 7 | Debt to Equity < 0.8 | ROCE 3Years > 15%
        filtered = df[
            (df["mcap"] > 25000) &
            (df["piotroski"] >= 7) &
            (df["de"] < 0.8) &
            (df["roce3Y"] > 15)
        ].copy()
    elif type == "solid-large-growth":
        # 6. Large Compounders: Market Cap > 20000 Cr | Sales Growth 3Years > 15% | ROCE 3Years > 18% | Debt to Equity < 1.0
        filtered = df[
            (df["mcap"] > 20000) &
            (df["sales3Y"] > 15) &
            (df["roce3Y"] > 18) &
            (df["de"] < 1.0)
        ].copy()
    else:
        filtered = pd.DataFrame(columns=df.columns)

    if filtered.empty:
        return {
            "type": type,
            "quotes": [],
            "summary": {
                "count": 0,
                "avgPe": 0.0,
                "avgSalesGrowth": 0.0,
                "avgPb": 0.0,
                "avgMcap": 0.0
            }
        }

    # Universal Intrinsic Value Ranking — same formula as the Ranking Tool
    # Higher Sales 3Y = better | Higher ROCE 3Y = better | Lower P/B = better
    # Missing values are scored worst (fillna with missing_rank)
    missing_rank = len(filtered) + 1

    def assign_rank(series: pd.Series, ascending: bool) -> pd.Series:
        ranked = series.rank(method="min", ascending=ascending, na_option="keep")
        return ranked.fillna(missing_rank).astype(int)

    filtered["salesRank"] = assign_rank(filtered["sales3Y"], ascending=False)
    filtered["roceRank"]  = assign_rank(filtered["roce3Y"],  ascending=False)
    filtered["pbRank"]    = assign_rank(filtered["pb"],      ascending=True)
    filtered["totalScore"] = filtered["salesRank"] + filtered["roceRank"] + filtered["pbRank"]

    filtered = filtered.sort_values(["totalScore", "name"], ascending=[True, True]).reset_index(drop=True)
    filtered["rank"] = filtered.index + 1

    def fmt(value: Any) -> float | None:
        if pd.isna(value) or value is None:
            return None
        return round(float(value), 2)

    records = [
        {
            "rank": int(row["rank"]),
            "name": str(row["name"]).strip(),
            "industry": str(row["industry"]).strip(),
            "marketCap": fmt(row["mcap"]),
            "sales3Y": fmt(row["sales3Y"]),
            "roce3Y": fmt(row["roce3Y"]),
            "pb": fmt(row["pb"])
        }
        for _, row in filtered.iterrows()
    ]

    # Summary averages
    avg_pe = filtered["pe"].dropna().mean() if not filtered["pe"].dropna().empty else 0.0
    avg_sales = filtered["sales3Y"].dropna().mean() if not filtered["sales3Y"].dropna().empty else 0.0
    avg_pb = filtered["pb"].dropna().mean() if not filtered["pb"].dropna().empty else 0.0
    avg_mcap = filtered["mcap"].dropna().mean() if not filtered["mcap"].dropna().empty else 0.0

    return {
        "type": type,
        "quotes": records,
        "summary": {
            "count": len(records),
            "avgPe": round(float(avg_pe), 2),
            "avgSalesGrowth": round(float(avg_sales), 2),
            "avgPb": round(float(avg_pb), 2),
            "avgMcap": round(float(avg_mcap), 2)
        }
    }


# --- Admin Page Endpoints ---
from pydantic import BaseModel

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/admin/login")
async def admin_login(req: LoginRequest) -> dict[str, str]:
    if req.username == "admin" and req.password == "adminpassword":
        return {"status": "ok", "token": "admin-session-token"}
    raise HTTPException(status_code=401, detail="Invalid admin username or password")


@router.post("/admin/upload-csv")
async def admin_upload_csv(
    file: UploadFile = File(...),
    file_type: str = Form(...),
    authorization: str = Header(None)
) -> dict[str, str]:
    # 1. Validate session token
    if not authorization or authorization != "Bearer admin-session-token":
        raise HTTPException(status_code=401, detail="Unauthorized admin session")
        
    # 2. Validate file type
    valid_types = {'sector_data', 'headwind_tailwind_history', 'stock_master'}
    if file_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid file_type: {file_type}")
        
    # 3. Validate file extension
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
    # 4. Determine file path
    from backend.utils.paths import CSV_PATH, HW_HISTORY_PATH, SECTOR_DATA_PATH, get_writable_path
    import shutil
    
    if file_type == 'sector_data':
        target_path = get_writable_path(SECTOR_DATA_PATH)
    elif file_type == 'headwind_tailwind_history':
        target_path = get_writable_path(HW_HISTORY_PATH)
    elif file_type == 'stock_master':
        target_path = get_writable_path(CSV_PATH)
    else:
        raise HTTPException(status_code=400, detail="Invalid file type")
        
    # 5. Overwrite the file on disk
    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
        

    return {"status": "success", "message": f"Successfully updated {file_type} CSV dataset"}




SEARCH_STOCKS_CACHE = {
    'mtime': 0,
    'stocks': []
}

@router.get("/search-stocks")
async def search_stocks_endpoint() -> dict[str, Any]:
    from backend.utils.paths import CSV_PATH
    from backend.services.analytics import get_stock_master_raw_df
    import pandas as pd
    
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail="stock_master.csv not found")
        
    try:
        current_mtime = CSV_PATH.stat().st_mtime
    except Exception:
        current_mtime = 0
        
    global SEARCH_STOCKS_CACHE
    if SEARCH_STOCKS_CACHE['stocks'] and SEARCH_STOCKS_CACHE['mtime'] == current_mtime:
        return {"stocks": SEARCH_STOCKS_CACHE['stocks']}
        
    try:
        df = get_stock_master_raw_df()
        df_clean = df[df['NSE Code'].notna() & (df['NSE Code'].astype(str).str.strip() != '')]
        records = df_clean[['NSE Code', 'Name']].to_dict(orient='records')
        stocks = [
            {
                "symbol": str(r['NSE Code']).strip(),
                "name": str(r['Name']).strip()
            }
            for r in records
        ]
        stocks.sort(key=lambda x: x['symbol'])
        
        SEARCH_STOCKS_CACHE['stocks'] = stocks
        SEARCH_STOCKS_CACHE['mtime'] = current_mtime
        return {"stocks": stocks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- TRAFFIC ANALYTICS ENDPOINTS ---
from pydantic import BaseModel
from backend.services.analytics_db import record_pageview, record_heartbeat, get_analytics_summary, get_live_users


class TrackPayload(BaseModel):
    visitor_id: str
    page_path: str
    page_title: str = ""
    referrer: str = ""
    parent_host: str = ""
    device_type: str = "Desktop"
    browser: str = "Unknown"
    is_heartbeat: bool = False


@router.post("/traffic/track")
async def track_traffic(payload: TrackPayload) -> dict[str, str]:
    try:
        if payload.is_heartbeat:
            record_heartbeat(
                visitor_id=payload.visitor_id,
                current_page=payload.page_path,
                parent_host=payload.parent_host,
                device_type=payload.device_type,
            )
        else:
            record_pageview(
                visitor_id=payload.visitor_id,
                page_path=payload.page_path,
                page_title=payload.page_title,
                referrer=payload.referrer,
                parent_host=payload.parent_host,
                device_type=payload.device_type,
                browser=payload.browser,
            )
        return {"status": "ok"}
    except Exception as e:
        # Silently log error to avoid breaking frontend user flow
        return {"status": "error", "message": str(e)}


@router.get("/admin/traffic/stats")
async def admin_traffic_stats(
    days: int = 30,
    authorization: str = Header(None)
) -> dict[str, Any]:
    if not authorization or authorization != "Bearer admin-session-token":
        raise HTTPException(status_code=401, detail="Unauthorized admin session")
    try:
        return get_analytics_summary(days=days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/traffic/live")
async def admin_traffic_live(
    authorization: str = Header(None)
) -> dict[str, Any]:
    if not authorization or authorization != "Bearer admin-session-token":
        raise HTTPException(status_code=401, detail="Unauthorized admin session")
    try:
        return get_live_users()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))







