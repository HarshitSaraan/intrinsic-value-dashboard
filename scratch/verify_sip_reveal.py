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
        
        print("Loading SIP page...")
        driver.get("http://127.0.0.1:8080/sip")
        time.sleep(3)
        
        # Capture Initial State
        initial_path = os.path.join(ARTIFACT_DIR, "sip_initial_load.png")
        driver.save_screenshot(initial_path)
        print(f"Captured initial load state screenshot to: {initial_path}")
        
        # Populate Inputs
        print("Entering calculation inputs...")
        amount_input = driver.find_element(By.ID, "ivSipAmount")
        amount_input.clear()
        amount_input.send_keys("25000")
        
        cagr_input = driver.find_element(By.ID, "ivSipCagr")
        cagr_input.clear()
        cagr_input.send_keys("12")
        
        years_input = driver.find_element(By.ID, "ivSipYears")
        years_input.clear()
        years_input.send_keys("15")
        
        stepup_input = driver.find_element(By.ID, "ivSipStepup")
        stepup_input.clear()
        stepup_input.send_keys("8")
        time.sleep(0.5)
        
        # Click Calculate
        print("Clicking Calculate SIP button...")
        calc_btn = driver.find_element(By.ID, "ivSipCalculate")
        driver.execute_script("arguments[0].click();", calc_btn)
        time.sleep(2)
        
        # Capture Calculated State
        calc_path = os.path.join(ARTIFACT_DIR, "sip_calculated_state.png")
        driver.save_screenshot(calc_path)
        print(f"Captured calculated state screenshot to: {calc_path}")
        
        # Scroll to table card and click header to expand it
        print("Locating and clicking Year-wise Table header...")
        table_header = driver.find_element(By.CLASS_NAME, "iv-collapse-header")
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", table_header)
        time.sleep(0.5)
        driver.execute_script("arguments[0].click();", table_header)
        time.sleep(1)
        
        # Capture expanded state
        expanded_path = os.path.join(ARTIFACT_DIR, "sip_table_expanded.png")
        driver.save_screenshot(expanded_path)
        print(f"Captured expanded table screenshot to: {expanded_path}")
        
        # Click Reset
        print("Clicking Reset button...")
        reset_btn = driver.find_element(By.ID, "ivSipReset")
        driver.execute_script("arguments[0].click();", reset_btn)
        time.sleep(1)
        
        # Capture Reset State
        reset_path = os.path.join(ARTIFACT_DIR, "sip_reset_state.png")
        driver.save_screenshot(reset_path)
        print(f"Captured reset state screenshot to: {reset_path}")
        
        driver.quit()
        print("Verification complete.")
        
    except Exception as e:
        print("An error occurred during verification:", e)

if __name__ == "__main__":
    main()
