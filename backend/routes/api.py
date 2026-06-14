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
    from backend.utils.paths import BASE_DIR
    
    sector_data_path = BASE_DIR / "sector_data.csv"
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


# Dynamic cache for Yahoo Finance predefined screeners
STRATEGIES_CACHE = {}
CACHE_TTL = 300 # 5 minutes

import threading
import time
from concurrent.futures import ThreadPoolExecutor

def update_all_strategies_cache():
    import urllib.request
    import urllib.parse
    import json
    import pandas as pd
    from backend.services.analytics import get_stock_master_raw_df
    from backend.utils.paths import CSV_PATH
    
    # 1. Load stock_master.csv
    try:
        df = get_stock_master_raw_df()
    except Exception as e:
        print(f"Error loading stock master in strategies background cache update: {e}")
        return
        
    # 2. Filter rows where NSE Code is present and valid
    df_nse = df[df['NSE Code'].notna() & (df['NSE Code'].astype(str).str.strip() != '')].copy()
    
    # Helper to parse float columns
    def clean_col(col_name):
        if col_name not in df_nse.columns:
            return pd.Series(float('nan'), index=df_nse.index)
        return pd.to_numeric(df_nse[col_name].astype(str).str.replace(',', '').str.replace('%', '').str.strip(), errors='coerce')
        
    df_nse['clean_mcap'] = clean_col('Market Capitalization')
    df_nse['clean_pe'] = clean_col('Price to Earning')
    df_nse['clean_pb'] = clean_col('Price to book value')
    df_nse['clean_sales_3y'] = clean_col('Sales growth 3Years')
    df_nse['clean_roce_3y'] = clean_col('Average return on capital employed 3Years')
    df_nse['clean_piotroski'] = clean_col('Piotroski score')
    df_nse['clean_de'] = clean_col('Debt to equity')
    
    strategy_types = [
        "undervalued-growth",
        "aggressive-smallcaps",
        "undervalued-largecaps",
        "growth-tech",
        "portfolio-anchors",
        "solid-large-growth"
    ]
    
    # For each strategy, get the filtered rows
    strategy_data = {}
    all_symbols = set()
    
    for stype in strategy_types:
        if stype == 'undervalued-growth': 
            filtered = df_nse[
                (df_nse['clean_sales_3y'] > 20) & 
                (df_nse['clean_pe'] > 0) & 
                (df_nse['clean_pe'] <= 25) & 
                (df_nse['clean_pb'] < 4.5)
            ]
        elif stype == 'aggressive-smallcaps':
            filtered = df_nse[
                (df_nse['clean_mcap'] < 2000) & 
                (df_nse['clean_sales_3y'] > 25) & 
                (df_nse['clean_roce_3y'] > 12)
            ]
        elif stype == 'undervalued-largecaps':
            filtered = df_nse[
                (df_nse['clean_mcap'] > 15000) & 
                (df_nse['clean_pe'] > 0) & 
                (df_nse['clean_pe'] < 18) & 
                (df_nse['clean_pb'] < 3.0)
            ]
        elif stype == 'growth-tech':
            tech_mask = df_nse['Industry Group'].fillna('').str.lower().str.contains('software|it -|telecom|tech')
            filtered = df_nse[tech_mask & (df_nse['clean_sales_3y'] > 20)]
        elif stype == 'portfolio-anchors':
            filtered = df_nse[
                (df_nse['clean_mcap'] > 25000) & 
                (df_nse['clean_piotroski'] >= 7) & 
                (df_nse['clean_de'] < 0.8) & 
                (df_nse['clean_roce_3y'] > 15)
            ]
        elif stype == 'solid-large-growth':
            filtered = df_nse[
                (df_nse['clean_mcap'] > 20000) & 
                (df_nse['clean_sales_3y'] > 15) & 
                (df_nse['clean_roce_3y'] > 18) & 
                (df_nse['clean_de'] < 1.0)
            ]
        else:
            filtered = pd.DataFrame(columns=df_nse.columns)
            
        filtered = filtered.sort_values(by='clean_mcap', ascending=False)
        
        records = []
        for _, row in filtered.iterrows():
            nse_code = str(row['NSE Code']).strip()
            records.append({
                'symbol': nse_code,
                'name': str(row['Name']).strip(),
                'csvPrice': row.get('Current Price'),
                'csvMcap': row.get('Market Capitalization'),
                'pe': row['clean_pe'] if pd.notna(row['clean_pe']) else None,
                'pb': row['clean_pb'] if pd.notna(row['clean_pb']) else None,
                # Fallbacks
                'price': row.get('Current Price'),
                'change': 0.0,
                'changePercent': 0.0,
                'volume': 0,
                'avgVolume': 0,
                'prevClose': row.get('Current Price'),
                'open': row.get('Current Price'),
                'low': row.get('Current Price'),
                'high': row.get('Current Price'),
                'closePrices': []
            })
            all_symbols.add(nse_code)
            
        strategy_data[stype] = records

    if not all_symbols:
        return
        
    # Query Yahoo Finance spark endpoint in parallel/batches of 20
    all_symbols_list = list(all_symbols)
    batches = [all_symbols_list[i:i+20] for i in range(0, len(all_symbols_list), 20)]
    
    quotes_data = {}
    
    def fetch_batch(batch):
        symbols_str = ",".join([urllib.parse.quote(s + ".NS") for s in batch])
        url = f"https://query1.finance.yahoo.com/v7/finance/spark?symbols={symbols_str}&range=1d&interval=15m"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            with urllib.request.urlopen(req, timeout=5) as res:
                raw_res = json.loads(res.read().decode())
                spark_res = raw_res.get('spark', {}).get('result', [])
                batch_quotes = {}
                for item in spark_res:
                    sym = item.get('symbol')
                    if not sym: continue
                    clean_sym = sym.replace('.NS', '')
                    resp_list = item.get('response', [])
                    if resp_list:
                        meta = resp_list[0].get('meta', {})
                        indicators = resp_list[0].get('indicators', {})
                        close_prices = indicators.get('quote', [{}])[0].get('close', [])
                        clean_closes = [c for c in close_prices if c is not None]
                        
                        price = meta.get('regularMarketPrice')
                        prev_close = meta.get('previousClose')
                        
                        change = 0.0
                        change_percent = 0.0
                        if price is not None and prev_close is not None and prev_close > 0:
                            change = price - prev_close
                            change_percent = (change / prev_close) * 100
                            
                        batch_quotes[clean_sym] = {
                            'price': price,
                            'prevClose': prev_close,
                            'change': change,
                            'changePercent': change_percent,
                            'volume': meta.get('regularMarketVolume', 0),
                            'high': meta.get('regularMarketDayHigh', price),
                            'low': meta.get('regularMarketDayLow', price),
                            'open': clean_closes[0] if clean_closes else price,
                            'closePrices': clean_closes,
                            'name': meta.get('longName', meta.get('shortName'))
                        }
                return batch_quotes
        except Exception as e:
            print(f"Error fetching spark batch in background scheduler: {e}")
            return {}

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(fetch_batch, b) for b in batches]
        for f in futures:
            quotes_data.update(f.result())

    # Merge Yahoo Finance data back into records and update global cache
    now = time.time()
    for stype, records in strategy_data.items():
        for r in records:
            sym = r['symbol']
            if sym in quotes_data:
                yd = quotes_data[sym]
                if yd.get('price') is not None:
                    r['price'] = yd['price']
                    r['prevClose'] = yd['prevClose']
                    r['change'] = yd['change']
                    r['changePercent'] = yd['changePercent']
                    r['volume'] = yd['volume']
                    r['high'] = yd['high']
                    r['low'] = yd['low']
                    r['open'] = yd['open']
                r['closePrices'] = yd['closePrices']
                if yd.get('name'):
                    r['name'] = yd['name']
            
            # Format market cap
            if r['csvMcap'] is not None and not pd.isna(r['csvMcap']):
                r['marketCap'] = float(r['csvMcap']) * 10000000
            else:
                r['marketCap'] = None
                
        STRATEGIES_CACHE[stype] = {
            'timestamp': now,
            'quotes': records
        }

def start_strategies_cache_scheduler():
    def loop():
        # wait a couple seconds on startup
        time.sleep(2)
        while True:
            try:
                update_all_strategies_cache()
            except Exception as e:
                print(f"Error in strategies cache scheduler: {e}")
            time.sleep(300) # every 5 minutes
            
    t = threading.Thread(target=loop, daemon=True)
    t.start()

start_strategies_cache_scheduler()

@router.get("/strategies-data")
async def strategies_endpoint(type: str = "undervalued-growth") -> dict[str, Any]:
    # 1. Check cache first
    if type in STRATEGIES_CACHE:
        return {"type": type, "quotes": STRATEGIES_CACHE[type]['quotes']}
        
    # 2. Cold cache/startup fallback: populate synchronously
    try:
        update_all_strategies_cache()
    except Exception as e:
        print(f"Failed to populate strategies cache synchronously: {e}")
        
    if type in STRATEGIES_CACHE:
        return {"type": type, "quotes": STRATEGIES_CACHE[type]['quotes']}
        
    return {"type": type, "quotes": []}


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
    from backend.utils.paths import BASE_DIR, CSV_PATH, HW_HISTORY_PATH
    import shutil
    
    if file_type == 'sector_data':
        target_path = BASE_DIR / "sector_data.csv"
    elif file_type == 'headwind_tailwind_history':
        target_path = HW_HISTORY_PATH
    elif file_type == 'stock_master':
        target_path = CSV_PATH
    else:
        raise HTTPException(status_code=400, detail="Invalid file type")
        
    # 5. Overwrite the file on disk
    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
    # 6. Post-processing (clear cache if stock_master was updated)
    if file_type == 'stock_master':
        STRATEGIES_CACHE.clear()
        
    return {"status": "success", "message": f"Successfully updated {file_type} CSV dataset"}


@router.get("/stock-financials")
async def stock_financials_endpoint(symbol: str) -> dict[str, Any]:
    import yfinance as yf
    import pandas as pd
    import datetime
    import json
    import time
    from backend.utils.paths import BASE_DIR

    clean_symbol = symbol.upper().strip()
    cache_dir = BASE_DIR / "backend" / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"{clean_symbol}.json"

    # Check Cache (TTL 24 hours = 86400 seconds)
    if cache_file.exists():
        try:
            with open(cache_file, "r") as f:
                cached_obj = json.load(f)
            if time.time() - cached_obj.get("timestamp", 0) < 86400:
                # Cache Hit! Return instantly
                return cached_obj.get("data")
        except Exception as cache_err:
            print(f"Failed to read financials cache for {clean_symbol}: {cache_err}")

    if not clean_symbol.endswith(".NS"):
        yahoo_symbol = clean_symbol + ".NS"
    else:
        yahoo_symbol = clean_symbol

    # Use custom requests session with browser-like headers to bypass bot restrictions on cloud hosts
    import requests
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://finance.yahoo.com/"
    })

    try:
        ticker = yf.Ticker(yahoo_symbol, session=session)
        q_fin = ticker.quarterly_financials
        a_fin = ticker.financials
        
        def extract_financials(df, is_quarterly=False):
            if df is None or df.empty:
                return []
            rev_row = None
            net_row = None
            ebitda_row = None
            
            # Find rows
            for idx in df.index:
                clean_idx = str(idx).lower().strip()
                if clean_idx == "total revenue":
                    rev_row = idx
                elif clean_idx == "net income":
                    net_row = idx
                elif clean_idx == "ebitda":
                    ebitda_row = idx
                    
            if not rev_row:
                for idx in df.index:
                    clean_idx = str(idx).lower().strip()
                    if clean_idx in ["revenue", "operating revenue", "gross sales"]:
                        rev_row = idx
                        break
            if not net_row:
                for idx in df.index:
                    clean_idx = str(idx).lower().strip()
                    if clean_idx in ["netincome", "net income continuous operations"]:
                        net_row = idx
                        break
                        
            if rev_row is None or net_row is None:
                return []
                
            items = []
            cols = sorted(df.columns)
            
            # Indian FY Quarter mapping (FY starts in April)
            # Month -> (Quarter, FY offset)
            quarter_map = {
                4: (1, 1), 5: (1, 1), 6: (1, 1),
                7: (2, 1), 8: (2, 1), 9: (2, 1),
                10: (3, 1), 11: (3, 1), 12: (3, 1),
                1: (4, 0), 2: (4, 0), 3: (4, 0)
            }
            
            for col in cols:
                date_str = str(col).split(" ")[0]
                try:
                    dt = datetime.datetime.strptime(date_str, "%Y-%m-%d")
                except:
                    dt = None
                    
                label = date_str
                annual_label = date_str
                if dt:
                    q, fy_offset = quarter_map.get(dt.month, (1, 1))
                    fy = dt.year + fy_offset
                    label = f"Q{q} FY{str(fy)[2:]}"
                    annual_label = f"FY{str(fy)[2:]}"
                
                rev = df.loc[rev_row, col]
                net = df.loc[net_row, col]
                
                if isinstance(rev, pd.Series):
                    rev = rev.iloc[0]
                if isinstance(net, pd.Series):
                    net = net.iloc[0]
                    
                if pd.isna(rev) or pd.isna(net):
                    continue
                
                ebitda = None
                if ebitda_row is not None:
                    ebitda_val = df.loc[ebitda_row, col]
                    if isinstance(ebitda_val, pd.Series):
                        ebitda_val = ebitda_val.iloc[0]
                    if not pd.isna(ebitda_val):
                        ebitda = float(ebitda_val)
                        
                profit_margin = None
                if rev != 0:
                    profit_margin = (float(net) / float(rev)) * 100.0
                    
                items.append({
                    "date": date_str,
                    "quarterLabel": label,
                    "annualLabel": annual_label,
                    "revenue": float(rev),
                    "earnings": float(net),
                    "ebitda": ebitda,
                    "profitMargin": profit_margin
                })
                
            # Calculate YoY changes using labels
            for item in items:
                item["revenueYoY"] = None
                item["earningsYoY"] = None
                
                if is_quarterly:
                    label = item.get("quarterLabel")
                    if label and len(label) >= 7:
                        q_part = label[:2]
                        try:
                            fy_part = int(label[5:])
                            prev_label = f"{q_part} FY{str(fy_part - 1).zfill(2)}"
                            prev_item = next((x for x in items if x.get("quarterLabel") == prev_label), None)
                            if prev_item:
                                if prev_item["revenue"] > 0:
                                    item["revenueYoY"] = ((item["revenue"] - prev_item["revenue"]) / prev_item["revenue"]) * 100.0
                                if prev_item["earnings"] != 0 and not pd.isna(prev_item["earnings"]):
                                    item["earningsYoY"] = ((item["earnings"] - prev_item["earnings"]) / abs(prev_item["earnings"])) * 100.0
                        except:
                            pass
                else:
                    label = item.get("annualLabel")
                    if label and label.startswith("FY") and len(label) >= 4:
                        try:
                            fy_val = int(label[2:])
                            prev_label = f"FY{str(fy_val - 1).zfill(2)}"
                            prev_item = next((x for x in items if x.get("annualLabel") == prev_label), None)
                            if prev_item:
                                if prev_item["revenue"] > 0:
                                    item["revenueYoY"] = ((item["revenue"] - prev_item["revenue"]) / prev_item["revenue"]) * 100.0
                                if prev_item["earnings"] != 0 and not pd.isna(prev_item["earnings"]):
                                    item["earningsYoY"] = ((item["earnings"] - prev_item["earnings"]) / abs(prev_item["earnings"])) * 100.0
                        except:
                            pass
            return items
            
        quarterly_data = extract_financials(q_fin, is_quarterly=True)
        annual_data = extract_financials(a_fin, is_quarterly=False)
        
        result_data = {
            "symbol": clean_symbol,
            "quarterly": quarterly_data[-4:],
            "annual": annual_data[-4:]
        }

        # Save to Cache
        try:
            with open(cache_file, "w") as f:
                json.dump({
                    "timestamp": time.time(),
                    "data": result_data
                }, f, indent=2)
        except Exception as cache_err:
            print(f"Failed to write financials cache for {clean_symbol}: {cache_err}")

        return result_data
    except Exception as e:
        print(f"Failed to fetch financials for {symbol}: {str(e)}")
        return {
            "symbol": clean_symbol,
            "quarterly": [],
            "annual": [],
            "error": True,
            "message": f"Yahoo Finance connection failed: {str(e)}"
        }


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






