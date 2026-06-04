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
        driver.set_window_size(1400, 1000)
        
        print("Loading Investment Ideas page...")
        driver.get("http://127.0.0.1:8080/strategies?type=undervalued-growth")
        time.sleep(4)
        
        # Capture strategy listings page
        listing_path = os.path.join(ARTIFACT_DIR, "strategies_listing.png")
        driver.save_screenshot(listing_path)
        print(f"Captured strategy list screenshot: {listing_path}")
        
        # Find the first row in the table and click it to open the modal
        print("Clicking first stock row...")
        rows = driver.find_elements(By.CLASS_NAME, "iv-strat-table-row")
        if not rows:
            print("No stock rows found! The screener table might be empty.")
            driver.quit()
            return
            
        driver.execute_script("arguments[0].click();", rows[0])
        time.sleep(5) # Wait for yfinance fetch and render
        
        # Capture modal with Quarterly view
        modal_quarterly_path = os.path.join(ARTIFACT_DIR, "financials_modal_quarterly.png")
        driver.save_screenshot(modal_quarterly_path)
        print(f"Captured quarterly financials modal: {modal_quarterly_path}")
        
        # Click Annual button
        print("Clicking 'Annual' view toggle...")
        annual_btn = driver.find_element(By.ID, "ivToggleAnnual")
        driver.execute_script("arguments[0].click();", annual_btn)
        time.sleep(2)
        
        # Capture modal with Annual view
        modal_annual_path = os.path.join(ARTIFACT_DIR, "financials_modal_annual.png")
        driver.save_screenshot(modal_annual_path)
        print(f"Captured annual financials modal: {modal_annual_path}")
        
        # Click Close
        print("Closing modal...")
        close_btn = driver.find_element(By.ID, "ivModalClose")
        driver.execute_script("arguments[0].click();", close_btn)
        time.sleep(1)
        
        # Capture final closed state
        closed_path = os.path.join(ARTIFACT_DIR, "financials_modal_closed.png")
        driver.save_screenshot(closed_path)
        print(f"Captured final closed state: {closed_path}")
        
        driver.quit()
        print("Verification complete.")
        
    except Exception as e:
        print("An error occurred during verification:", e)

if __name__ == "__main__":
    main()
