from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CSV_PATH = BASE_DIR / "stock_master.csv"
HW_HISTORY_PATH = BASE_DIR / "headwind_tailwind_history.csv"
DASHBOARD_PATH = BASE_DIR / "dashboard_master.html"
