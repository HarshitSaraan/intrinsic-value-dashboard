import time
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains

ARTIFACT_DIR = r"C:\Users\harsh\.gemini\antigravity\brain\570e56f3-c1ab-48ee-a4c6-f9e920ec7551"

def main():
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    
    try:
        driver = webdriver.Chrome(options=chrome_options)
        driver.set_window_size(1400, 1000)
        
        print("Loading Market Valuation Index page...")
        driver.get("http://127.0.0.1:8080/market-valuation-index")
        time.sleep(3)
        
        # Test Default Sector: Nifty 50 (should be loaded by default)
        print("Testing Nifty 50 (default sector)...")
        canvas = driver.find_element(By.ID, "ivSectorValuationCanvas")
        actions = ActionChains(driver)
        # Hover over canvas to show tooltip
        actions.move_to_element(canvas).perform()
        time.sleep(1)
        
        nifty_path = os.path.join(ARTIFACT_DIR, "nifty50_valuation_chart.png")
        driver.save_screenshot(nifty_path)
        print(f"Captured Nifty 50 chart screenshot to: {nifty_path}")
        
        # Select Gold Valuation via JS click
        print("Locating and clicking Gold Valuation button...")
        gold_btn = driver.find_element(By.XPATH, "//button[@data-sector='Gold Valuation']")
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", gold_btn)
        time.sleep(0.5)
        driver.execute_script("arguments[0].click();", gold_btn)
        time.sleep(2)
        
        # Hover over canvas to show tooltip
        actions = ActionChains(driver)
        actions.move_to_element(canvas).perform()
        time.sleep(1)
        
        gold_path = os.path.join(ARTIFACT_DIR, "gold_valuation_chart.png")
        driver.save_screenshot(gold_path)
        print(f"Captured Gold Valuation chart screenshot to: {gold_path}")
        
        driver.quit()
        print("Verification complete.")
        
    except Exception as e:
        print("An error occurred during verification:", e)

if __name__ == "__main__":
    main()
