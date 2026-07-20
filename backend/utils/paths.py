from pathlib import Path
import tempfile
import os

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class DynamicPathProxy:
    def __init__(self, filename: str):
        self.filename = filename

    @property
    def target(self) -> Path:
        tmp_path = Path(tempfile.gettempdir()) / self.filename
        if tmp_path.exists():
            return tmp_path
        return BASE_DIR / self.filename

    def __getattr__(self, name):
        return getattr(self.target, name)

    def __str__(self):
        return str(self.target)

    def __repr__(self):
        return repr(self.target)

    def __fspath__(self):
        return os.fspath(self.target)

CSV_PATH = DynamicPathProxy("stock_master.csv")
HW_HISTORY_PATH = DynamicPathProxy("headwind_tailwind_history.csv")
SECTOR_DATA_PATH = DynamicPathProxy("sector_data.csv")
TRAFFIC_DB_PATH = DynamicPathProxy("traffic.db")

def get_writable_path(proxy: DynamicPathProxy) -> Path:
    filename = proxy.filename
    # If Vercel or AWS Lambda environment, we can only write to the temp directory
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return Path(tempfile.gettempdir()) / filename
        
    # Check if root directory is writable
    try:
        target = BASE_DIR / filename
        test_file = target.parent / f".write_test_{os.getpid()}"
        test_file.touch()
        test_file.unlink()
        return target
    except (OSError, PermissionError):
        return Path(tempfile.gettempdir()) / filename

