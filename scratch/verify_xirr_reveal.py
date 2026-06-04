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
        
        print("Loading XIRR page...")
        driver.get("http://127.0.0.1:8000/xirr")
        time.sleep(3)
        
        # Capture Initial State
        initial_path = os.path.join(ARTIFACT_DIR, "xirr_initial_load.png")
        driver.save_screenshot(initial_path)
        print(f"Captured initial load state screenshot to: {initial_path}")
        
        # Populate first cashflow row
        print("Entering first cashflow...")
        rows = driver.find_elements(By.CLASS_NAME, "iv-xirr-cashflow-row")
        date_1 = rows[0].find_element(By.CLASS_NAME, "iv-xirr-date")
        date_1.send_keys("01-01-2023") # format depends on system, but text input sends standard strings or HTML dates
        invested_1 = rows[0].find_element(By.CLASS_NAME, "iv-xirr-invested")
        invested_1.send_keys("100000")
        
        # Click Add Row
        print("Adding a cashflow row...")
        add_btn = driver.find_element(By.ID, "ivXirrAddRow")
        driver.execute_script("arguments[0].click();", add_btn)
        time.sleep(0.5)
        
        # Populate second row
        print("Entering second cashflow...")
        rows = driver.find_elements(By.CLASS_NAME, "iv-xirr-cashflow-row")
        date_2 = rows[1].find_element(By.CLASS_NAME, "iv-xirr-date")
        date_2.send_keys("01-01-2024")
        invested_2 = rows[1].find_element(By.CLASS_NAME, "iv-xirr-invested")
        invested_2.send_keys("50000")
        
        # Click Add Row for withdrawal
        print("Adding a withdrawal cashflow row...")
        driver.execute_script("arguments[0].click();", add_btn)
        time.sleep(0.5)
        
        # Populate third row (withdrawal)
        rows = driver.find_elements(By.CLASS_NAME, "iv-xirr-cashflow-row")
        date_3 = rows[2].find_element(By.CLASS_NAME, "iv-xirr-date")
        date_3.send_keys("01-07-2024")
        withdrawn_3 = rows[2].find_element(By.CLASS_NAME, "iv-xirr-withdrawn")
        withdrawn_3.send_keys("20000")
        
        # Populate Current Capital
        print("Entering current portfolio value details...")
        current_cap = driver.find_element(By.ID, "ivXirrCurrentCapital")
        current_cap.clear()
        current_cap.send_keys("180000")
        
        valuation_date = driver.find_element(By.ID, "ivXirrValuationDate")
        valuation_date.send_keys("01-01-2025")
        time.sleep(0.5)
        
        # Click Calculate
        print("Clicking Calculate XIRR button...")
        calc_btn = driver.find_element(By.ID, "ivXirrCalculate")
        driver.execute_script("arguments[0].click();", calc_btn)
        time.sleep(2)
        
        # Capture Calculated State
        calc_path = os.path.join(ARTIFACT_DIR, "xirr_calculated_state.png")
        driver.save_screenshot(calc_path)
        print(f"Captured calculated state screenshot to: {calc_path}")
        
        # Click Reset
        print("Clicking Reset button...")
        reset_btn = driver.find_element(By.ID, "ivXirrReset")
        driver.execute_script("arguments[0].click();", reset_btn)
        time.sleep(1)
        
        # Capture Reset State
        reset_path = os.path.join(ARTIFACT_DIR, "xirr_reset_state.png")
        driver.save_screenshot(reset_path)
        print(f"Captured reset state screenshot to: {reset_path}")
        
        driver.quit()
        print("Verification complete.")
        
    except Exception as e:
        print("An error occurred during verification:", e)

if __name__ == "__main__":
    main()
