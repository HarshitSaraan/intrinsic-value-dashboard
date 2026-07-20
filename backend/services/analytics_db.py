import sqlite3
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

from backend.utils.paths import TRAFFIC_DB_PATH, get_writable_path


def get_db_path() -> Path:
    return get_writable_path(TRAFFIC_DB_PATH)


def init_db() -> None:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()

        # Page views table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS page_views (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                date_str TEXT NOT NULL,
                visitor_id TEXT NOT NULL,
                page_path TEXT NOT NULL,
                page_title TEXT,
                referrer TEXT,
                parent_host TEXT,
                device_type TEXT,
                browser TEXT
            )
        """)

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_pv_timestamp ON page_views(timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_pv_date_str ON page_views(date_str)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_pv_visitor ON page_views(visitor_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_pv_page ON page_views(page_path)")

        # Active sessions table for live users pulse
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS active_sessions (
                visitor_id TEXT PRIMARY KEY,
                last_seen INTEGER NOT NULL,
                current_page TEXT,
                parent_host TEXT,
                device_type TEXT
            )
        """)

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as_last_seen ON active_sessions(last_seen)")

        conn.commit()


def record_pageview(
    visitor_id: str,
    page_path: str,
    page_title: str = "",
    referrer: str = "",
    parent_host: str = "",
    device_type: str = "Desktop",
    browser: str = "Unknown",
) -> None:
    init_db()
    now_ts = int(time.time())
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    db_path = get_db_path()
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        # Record hit
        cursor.execute(
            """
            INSERT INTO page_views 
            (timestamp, date_str, visitor_id, page_path, page_title, referrer, parent_host, device_type, browser)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (now_ts, date_str, visitor_id, page_path, page_title, referrer, parent_host, device_type, browser),
        )

        # Update active session
        cursor.execute(
            """
            INSERT INTO active_sessions (visitor_id, last_seen, current_page, parent_host, device_type)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(visitor_id) DO UPDATE SET
                last_seen = excluded.last_seen,
                current_page = excluded.current_page,
                parent_host = excluded.parent_host,
                device_type = excluded.device_type
            """,
            (visitor_id, now_ts, page_path, parent_host, device_type),
        )

        conn.commit()


def record_heartbeat(
    visitor_id: str,
    current_page: str = "",
    parent_host: str = "",
    device_type: str = "Desktop",
) -> None:
    init_db()
    now_ts = int(time.time())

    db_path = get_db_path()
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO active_sessions (visitor_id, last_seen, current_page, parent_host, device_type)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(visitor_id) DO UPDATE SET
                last_seen = excluded.last_seen,
                current_page = excluded.current_page,
                parent_host = excluded.parent_host,
                device_type = excluded.device_type
            """,
            (visitor_id, now_ts, current_page, parent_host, device_type),
        )
        conn.commit()


def get_live_users(timeout_seconds: int = 180) -> Dict[str, Any]:
    init_db()
    now_ts = int(time.time())
    threshold_ts = now_ts - timeout_seconds

    db_path = get_db_path()
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        # Clean up stale sessions
        cursor.execute("DELETE FROM active_sessions WHERE last_seen < ?", (threshold_ts,))
        conn.commit()

        # Get total active count
        cursor.execute("SELECT COUNT(*) FROM active_sessions")
        total_live = cursor.fetchone()[0] or 0

        # Page breakdown
        cursor.execute(
            """
            SELECT current_page, COUNT(*) as cnt
            FROM active_sessions
            GROUP BY current_page
            ORDER BY cnt DESC
            LIMIT 5
            """
        )
        page_rows = cursor.fetchall()
        pages = [{"page": row[0] or "Home", "count": row[1]} for row in page_rows]

        # Embed breakdown
        cursor.execute(
            """
            SELECT parent_host, COUNT(*) as cnt
            FROM active_sessions
            WHERE parent_host IS NOT NULL AND parent_host != ''
            GROUP BY parent_host
            ORDER BY cnt DESC
            LIMIT 5
            """
        )
        embed_rows = cursor.fetchall()
        embeds = [{"host": row[0], "count": row[1]} for row in embed_rows]

        return {
            "total_live": total_live,
            "active_pages": pages,
            "active_embeds": embeds,
            "as_of": now_ts,
        }


def get_analytics_summary(days: int = 30) -> Dict[str, Any]:
    init_db()
    now_utc = datetime.now(timezone.utc)
    today_str = now_utc.strftime("%Y-%m-%d")
    now_ts = int(time.time())

    start_date_utc = now_utc - timedelta(days=days)
    start_ts = int(start_date_utc.timestamp())

    # Today start ts
    today_start_dt = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)
    today_start_ts = int(today_start_dt.timestamp())

    # 7 days start ts
    seven_days_dt = now_utc - timedelta(days=7)
    seven_days_ts = int(seven_days_dt.timestamp())

    db_path = get_db_path()
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()

        # 1. Total views & uniques (Today, 7 days, 30 days)
        def get_counts(from_ts: int):
            cursor.execute("SELECT COUNT(*), COUNT(DISTINCT visitor_id) FROM page_views WHERE timestamp >= ?", (from_ts,))
            row = cursor.fetchone()
            return row[0] or 0, row[1] or 0

        views_today, uniques_today = get_counts(today_start_ts)
        views_7d, uniques_7d = get_counts(seven_days_ts)
        views_30d, uniques_30d = get_counts(start_ts)

        # 2. Daily trends over selected range
        cursor.execute(
            """
            SELECT date_str, COUNT(*), COUNT(DISTINCT visitor_id)
            FROM page_views
            WHERE timestamp >= ?
            GROUP BY date_str
            ORDER BY date_str ASC
            """,
            (start_ts,),
        )
        trend_rows = cursor.fetchall()
        trends_dict = {r[0]: {"views": r[1], "uniques": r[2]} for r in trend_rows}

        # Build complete daily sequence
        daily_trends = []
        for d in range(days - 1, -1, -1):
            day_date = (now_utc - timedelta(days=d)).strftime("%Y-%m-%d")
            data = trends_dict.get(day_date, {"views": 0, "uniques": 0})
            daily_trends.append({
                "date": day_date,
                "label": (now_utc - timedelta(days=d)).strftime("%b %d"),
                "views": data["views"],
                "uniques": data["uniques"],
            })

        # 3. Top Pages (over the 30-day window)
        cursor.execute(
            """
            SELECT page_path, COUNT(*) as views, COUNT(DISTINCT visitor_id) as uniques
            FROM page_views
            WHERE timestamp >= ?
            GROUP BY page_path
            ORDER BY views DESC
            LIMIT 10
            """,
            (start_ts,),
        )
        page_rows = cursor.fetchall()
        top_pages = [
            {"page": r[0] or "Home", "views": r[1], "uniques": r[2]}
            for r in page_rows
        ]

        # 4. Top Referrers / Embed Hosts
        cursor.execute(
            """
            SELECT parent_host, COUNT(*) as views
            FROM page_views
            WHERE timestamp >= ? AND parent_host IS NOT NULL AND parent_host != ''
            GROUP BY parent_host
            ORDER BY views DESC
            LIMIT 8
            """,
            (start_ts,),
        )
        embed_rows = cursor.fetchall()
        top_embeds = [{"host": r[0], "views": r[1]} for r in embed_rows]

        # Standard referrers
        cursor.execute(
            """
            SELECT referrer, COUNT(*) as views
            FROM page_views
            WHERE timestamp >= ? AND referrer IS NOT NULL AND referrer != '' AND referrer NOT LIKE '%localhost%'
            GROUP BY referrer
            ORDER BY views DESC
            LIMIT 8
            """,
            (start_ts,),
        )
        ref_rows = cursor.fetchall()
        top_referrers = [{"referrer": r[0], "views": r[1]} for r in ref_rows]

        # 5. Device Breakdown
        cursor.execute(
            """
            SELECT device_type, COUNT(*) as views
            FROM page_views
            WHERE timestamp >= ?
            GROUP BY device_type
            """,
            (start_ts,),
        )
        device_rows = cursor.fetchall()
        total_device_views = sum(r[1] for r in device_rows) or 1
        devices = {
            "Desktop": 0,
            "Mobile": 0,
            "Tablet": 0,
        }
        for r in device_rows:
            dt = r[0] if r[0] in devices else "Desktop"
            devices[dt] = round((r[1] / total_device_views) * 100, 1)

        # 6. Live status
        live_data = get_live_users()

        return {
            "summary": {
                "today": {"views": views_today, "uniques": uniques_today},
                "seven_days": {"views": views_7d, "uniques": uniques_7d},
                "thirty_days": {"views": views_30d, "uniques": uniques_30d},
            },
            "daily_trends": daily_trends,
            "top_pages": top_pages,
            "top_embeds": top_embeds,
            "top_referrers": top_referrers,
            "devices": devices,
            "live": live_data,
        }
