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
        
        print("Loading GAWP page...")
        driver.get("http://127.0.0.1:8000/gawp")
        time.sleep(3)
        
        # Capture Initial State
        initial_path = os.path.join(ARTIFACT_DIR, "gawp_initial_load.png")
        driver.save_screenshot(initial_path)
        print(f"Captured initial load state screenshot to: {initial_path}")
        
        # Populate Inputs
        print("Entering calculation inputs...")
        age_input = driver.find_element(By.ID, "ivGawpAge")
        age_input.clear()
        age_input.send_keys("35")
        
        cap_input = driver.find_element(By.ID, "ivGawpCapital")
        cap_input.clear()
        cap_input.send_keys("5000000")
        
        adjust_cagr = driver.find_element(By.ID, "ivGawpAdjustCagr")
        driver.execute_script("arguments[0].click();", adjust_cagr)
        time.sleep(0.5)
        
        cagr_input = driver.find_element(By.ID, "ivGawpCagr")
        cagr_input.clear()
        cagr_input.send_keys("14.5")
        time.sleep(0.5)
        
        # Click Calculate
        print("Clicking Check Wealth Badge button...")
        calc_btn = driver.find_element(By.ID, "ivGawpCalculate")
        driver.execute_script("arguments[0].click();", calc_btn)
        time.sleep(2)
        
        # Capture Calculated State
        calc_path = os.path.join(ARTIFACT_DIR, "gawp_calculated_state.png")
        driver.save_screenshot(calc_path)
        print(f"Captured calculated state screenshot to: {calc_path}")

        # Capture Hover Menu State
        try:
            print("Hovering over Personal Finance nav item...")
            from selenium.webdriver.common.action_chains import ActionChains
            nav_groups = driver.find_elements(By.CLASS_NAME, "iv-nav-group")
            target_group = None
            for group in nav_groups:
                try:
                    btn = group.find_element(By.CLASS_NAME, "iv-nav-group-btn")
                    if "Personal Finance" in btn.text:
                        target_group = group
                        break
                except:
                    pass
            if target_group:
                actions = ActionChains(driver)
                actions.move_to_element(target_group).perform()
                time.sleep(1)
                hover_path = os.path.join(ARTIFACT_DIR, "gawp_menu_hover.png")
                driver.save_screenshot(hover_path)
                print(f"Captured hover menu screenshot to: {hover_path}")
        except Exception as he:
            print("Failed to capture hover menu state:", he)
        
        # Click Reset
        print("Clicking Reset button...")
        reset_btn = driver.find_element(By.ID, "ivGawpReset")
        driver.execute_script("arguments[0].click();", reset_btn)
        time.sleep(1)
        
        # Capture Reset State
        reset_path = os.path.join(ARTIFACT_DIR, "gawp_reset_state.png")
        driver.save_screenshot(reset_path)
        print(f"Captured reset state screenshot to: {reset_path}")
        
        driver.quit()
        print("Verification complete.")
        
    except Exception as e:
        print("An error occurred during verification:", e)

if __name__ == "__main__":
    main()
