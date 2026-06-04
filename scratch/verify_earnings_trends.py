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
        
        print("Loading Earnings Trends Search page...")
        driver.get("http://127.0.0.1:8080/earnings-trends")
        time.sleep(4)
        
        # Capture Initial State
        initial_path = os.path.join(ARTIFACT_DIR, "earnings_trends_initial.png")
        driver.save_screenshot(initial_path)
        print(f"Captured initial search state: {initial_path}")
        
        # Type 'TCS' inside the search input box
        print("Typing 'TCS' in search box...")
        search_input = driver.find_element(By.ID, "ivStockSearchInput")
        search_input.send_keys("TCS")
        time.sleep(1.5)
        
        # Click on the TCS row in the results list
        print("Selecting TCS from results list...")
        tcs_row = driver.find_element(By.XPATH, "//div[contains(@class, 'iv-stock-item-row') and .//span[text()='TCS']]")
        driver.execute_script("arguments[0].click();", tcs_row)
        time.sleep(5) # Wait for yfinance load
        
        # Capture Quarterly chart reveal state
        quarterly_path = os.path.join(ARTIFACT_DIR, "earnings_trends_quarterly.png")
        driver.save_screenshot(quarterly_path)
        print(f"Captured quarterly chart: {quarterly_path}")
        
        # Toggle to Annual view
        print("Clicking Annual view...")
        annual_btn = driver.find_element(By.ID, "ivToggleAnnual")
        driver.execute_script("arguments[0].click();", annual_btn)
        time.sleep(2)
        
        # Capture Annual chart view
        annual_path = os.path.join(ARTIFACT_DIR, "earnings_trends_annual.png")
        driver.save_screenshot(annual_path)
        print(f"Captured annual chart: {annual_path}")

        # Test mobile responsive behavior
        print("Testing mobile responsive layout...")
        driver.set_window_size(375, 812)
        time.sleep(2)
        
        # Verify that search area is hidden in mobile view when stock is loaded
        search_area = driver.find_element(By.ID, "ivTrendsSearchArea")
        print(f"Is search area displayed on mobile when stock loaded? {search_area.is_displayed()}")
        
        # Capture mobile layout screenshot
        mobile_path = os.path.join(ARTIFACT_DIR, "earnings_trends_mobile_chart.png")
        driver.save_screenshot(mobile_path)
        print(f"Captured mobile view chart: {mobile_path}")
        
        # Click back to search button
        print("Clicking 'Back to Search' button...")
        back_btn = driver.find_element(By.ID, "ivTrendsBackButton")
        driver.execute_script("arguments[0].click();", back_btn)
        time.sleep(2)
        
        print(f"Is search area displayed on mobile after clicking back? {search_area.is_displayed()}")
        mobile_search_path = os.path.join(ARTIFACT_DIR, "earnings_trends_mobile_search.png")
        driver.save_screenshot(mobile_search_path)
        print(f"Captured mobile view search: {mobile_search_path}")
        
        driver.quit()
        print("Verification complete.")
        
    except Exception as e:
        print("An error occurred during verification:", e)

if __name__ == "__main__":
    main()
