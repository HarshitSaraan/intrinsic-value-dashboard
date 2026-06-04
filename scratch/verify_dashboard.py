import time
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

ARTIFACT_DIR = r"C:\Users\harsh\.gemini\antigravity\brain\570e56f3-c1ab-48ee-a4c6-f9e920ec7551"

def main():
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    
    try:
        driver = webdriver.Chrome(options=chrome_options)
        
        # Verify Desktop view
        driver.set_window_size(1400, 1000)
        print("Loading Dashboard Home (Desktop)...")
        driver.get("http://127.0.0.1:8000/dashboard")
        time.sleep(3)
        
        # Initial desktop state
        desktop_path = os.path.join(ARTIFACT_DIR, "dashboard_view_desktop_initial.png")
        driver.save_screenshot(desktop_path)
        print(f"Captured initial desktop dashboard: {desktop_path}")
        
        # Scroll down to trigger card overlap (Card 2 overlapping Card 1)
        print("Scrolling down to trigger Card 2 overlap...")
        driver.execute_script("window.scrollTo(0, 1100);")
        time.sleep(2)
        
        scrolled_path = os.path.join(ARTIFACT_DIR, "dashboard_view_desktop_scrolled.png")
        driver.save_screenshot(scrolled_path)
        print(f"Captured scrolled desktop dashboard (overlap): {scrolled_path}")
        
        # Scroll down further (Card 3 overlapping Card 2)
        print("Scrolling down further to trigger Card 3 overlap...")
        driver.execute_script("window.scrollTo(0, 1600);")
        time.sleep(2)
        
        scrolled_full_path = os.path.join(ARTIFACT_DIR, "dashboard_view_desktop_scrolled_full.png")
        driver.save_screenshot(scrolled_full_path)
        print(f"Captured fully scrolled desktop dashboard (Card 3 overlap): {scrolled_full_path}")
        
        # Verify Mobile view
        driver.set_window_size(430, 932) # iPhone 14 Pro Max dimensions
        print("Loading Dashboard Home (Mobile)...")
        driver.get("http://127.0.0.1:8000/dashboard")
        time.sleep(3)
        
        # Initial mobile state
        mobile_path = os.path.join(ARTIFACT_DIR, "dashboard_view_mobile_initial.png")
        driver.save_screenshot(mobile_path)
        print(f"Captured initial mobile dashboard: {mobile_path}")
        
        # Scroll down on mobile to check Card 1 tools listing
        print("Scrolling down on mobile...")
        driver.execute_script("window.scrollTo(0, 1400);")
        time.sleep(2)
        
        mobile_scrolled_path = os.path.join(ARTIFACT_DIR, "dashboard_view_mobile_scrolled.png")
        driver.save_screenshot(mobile_scrolled_path)
        print(f"Captured scrolled mobile dashboard: {mobile_scrolled_path}")
        
        driver.quit()
        print("Verification complete.")
        
    except Exception as e:
        print("An error occurred during verification:", e)

if __name__ == "__main__":
    main()
