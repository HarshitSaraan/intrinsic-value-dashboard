from __future__ import annotations

from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException

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
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail=f"CSV file not found: {CSV_PATH.name}")
    frame = pd.read_csv(CSV_PATH)
    industry_col = pick_column(frame, "Industry", "Industry Group")
    if industry_col is None:
        return {"industries": []}
    return {"industries": sorted(frame[industry_col].dropna().astype(str).str.strip().unique().tolist())}


@router.get("/portfolio-search")
async def portfolio_search_endpoint(q: str = "") -> dict[str, Any]:
    return {"results": search_stocks(q)}


@router.get("/portfolio-evaluate")
async def portfolio_evaluate_endpoint(q: str = "") -> dict[str, Any]:
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
    return evaluate_portfolio_stock(q)


@router.get("/sector-valuation")
async def sector_valuation_endpoint() -> dict[str, Any]:
    import math
    from backend.utils.paths import BASE_DIR
    
    sector_data_path = BASE_DIR / "sector_data.csv"
    if not sector_data_path.exists():
        raise HTTPException(status_code=404, detail="sector_data.csv not found")
        
    df = pd.read_csv(sector_data_path, header=None)
    row0 = df.iloc[0].tolist()
    row1 = df.iloc[1].tolist()
    
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
        cols = sector_columns[s]
        idx_col = next((c[0] for c in cols if 'index' in c[1].lower() or c[1].lower() == s.lower()), None)
        pe_col = next((c[0] for c in cols if 'p/e' in c[1].lower()), None)
        pb_col = next((c[0] for c in cols if 'p/b' in c[1].lower()), None)
        div_col = next((c[0] for c in cols if 'div' in c[1].lower() or 'yield' in c[1].lower()), None)
        
        series = []
        for r_idx in range(2, len(df)):
            date = str(df.iloc[r_idx, 0]).strip()
            if pd.isna(df.iloc[r_idx, 0]) or date == '' or date.lower() == 'nan':
                continue
                
            def get_val(col):
                if col is None: return None
                val = df.iloc[r_idx, col]
                if pd.isna(val): return None
                val_str = str(val).replace(',', '').replace('%', '').strip()
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
        
    return {"sectors": sectors, "data": result}


@router.get("/strategies-data")
async def strategies_endpoint() -> dict[str, Any]:
    if not CSV_PATH.exists():
        raise HTTPException(status_code=404, detail=f"CSV file not found: {CSV_PATH.name}")
    df = pd.read_csv(CSV_PATH)
    
    def to_float(val):
        try:
            return float(str(val).replace(',', '').strip())
        except ValueError:
            return 0.0

    df['Market Cap Float'] = df['Market Capitalization'].apply(to_float)
    df['PE Float'] = df['Price to Earning'].apply(to_float)
    df['PB Float'] = df['Price to book value'].apply(to_float)
    df['Sales Growth 3Y Float'] = df['Sales growth 3Years'].apply(to_float)
    df['ROCE 3Y Float'] = df['Average return on capital employed 3Years'].apply(to_float)
    df['Debt Equity Float'] = df['Debt to equity'].apply(to_float)
    df['Piotroski Float'] = df['Piotroski score'].apply(to_float)
    df['Industry Str'] = df['Industry'].fillna('').astype(str).str.strip()

    # S1: Undervalued Growth Stocks
    ug_df = df[(df['Sales Growth 3Y Float'] > 20) & (df['PE Float'] > 0) & (df['PE Float'] < 25) & (df['PB Float'] < 4.5)]
    ug_list = ug_df.sort_values(by='Sales Growth 3Y Float', ascending=False).head(30)

    # S2: Aggressive Small Caps
    as_df = df[(df['Market Cap Float'] > 0) & (df['Market Cap Float'] < 2000) & (df['Sales Growth 3Y Float'] > 25) & (df['ROCE 3Y Float'] > 12)]
    as_list = as_df.sort_values(by='Sales Growth 3Y Float', ascending=False).head(30)

    # S3: Undervalued Large Caps
    ul_df = df[(df['Market Cap Float'] > 15000) & (df['PE Float'] > 0) & (df['PE Float'] < 18) & (df['PB Float'] < 3)]
    ul_list = ul_df.sort_values(by='Market Cap Float', ascending=False).head(30)

    # S4: Growth Technology Stocks
    tech_mask = df['Industry Str'].str.lower().str.contains('software|it |computers|telecom|tech')
    gt_df = df[tech_mask & (df['Sales Growth 3Y Float'] > 20)]
    gt_list = gt_df.sort_values(by='Sales Growth 3Y Float', ascending=False).head(30)

    # S5: Portfolio Anchors
    pa_df = df[(df['Market Cap Float'] > 25000) & (df['Piotroski Float'] >= 7) & (df['Debt Equity Float'] < 0.8) & (df['ROCE 3Y Float'] > 15)]
    pa_list = pa_df.sort_values(by='Market Cap Float', ascending=False).head(30)

    # S6: Solid Large Growth Funds
    sl_df = df[(df['Market Cap Float'] > 20000) & (df['Sales Growth 3Y Float'] > 15) & (df['ROCE 3Y Float'] > 18) & (df['Debt Equity Float'] < 1.0)]
    sl_list = sl_df.sort_values(by='Market Cap Float', ascending=False).head(30)

    def df_to_records(sub_df):
        records = []
        for _, row in sub_df.iterrows():
            records.append({
                'name': str(row['Name']),
                'nseCode': str(row['NSE Code']) if pd.notna(row['NSE Code']) else '',
                'bseCode': str(row['BSE Code']) if pd.notna(row['BSE Code']) else '',
                'industry': str(row['Industry']) if pd.notna(row['Industry']) else '',
                'mcap': float(row['Market Cap Float']),
                'price': float(to_float(row['Current Price'])),
                'pe': float(row['PE Float']),
                'pb': float(row['PB Float']),
                'salesGrowth3Y': float(row['Sales Growth 3Y Float']),
                'roce3Y': float(row['ROCE 3Y Float']),
                'debtEquity': float(row['Debt Equity Float']),
                'piotroski': int(row['Piotroski Float'])
            })
        return records

    return {
        'undervalued-growth': df_to_records(ug_list),
        'aggressive-smallcaps': df_to_records(as_list),
        'undervalued-largecaps': df_to_records(ul_list),
        'growth-tech': df_to_records(gt_list),
        'portfolio-anchors': df_to_records(pa_list),
        'solid-large-growth': df_to_records(sl_list)
    }


