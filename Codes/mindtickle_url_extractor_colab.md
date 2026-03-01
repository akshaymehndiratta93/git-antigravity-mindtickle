# Mindtickle Recording List Extractor (Large Lists)

This script is optimized to handle large lists (e.g., 400+ recordings) by iteratively collecting data as it scrolls through Mindtickle's virtual list.

### **Prerequisites**
1.  **Google Colab**: Open [Google Colab](https://colab.research.google.com/).
2.  **Cookies**: Copy the cookie string from your browser (Network tab > Cookie header).
3.  **Google Sheet**: Have a target Google Sheet ID ready.

---

### **Step 1: Environment Setup**
Run this cell to install dependencies and configure Selenium.

```python
!pip install selenium gspread google-auth webdriver-manager
!apt-get update
!apt-get install -y wget curl unzip
# Install Chrome
!wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
!apt-get install -y ./google-chrome-stable_current_amd64.deb

import json
import time
import gspread
from google.colab import auth
from google.auth import default
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Setup Chrome Options
chrome_options = Options()
chrome_options.add_argument('--headless')
chrome_options.add_argument('--no-sandbox')
chrome_options.add_argument('--disable-dev-shm-usage')

def get_driver():
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=chrome_options)

# Authenticate Google Sheets
auth.authenticate_user()
creds, _ = default()
gc = gspread.authorize(creds)
```

---

### **Step 2: Scraper Configuration**
Paste your URL and cookie string.

```python
# --- CONFIGURATION ---
TARGET_URL = "PASTE_YOUR_FILTERED_URL_HERE"
SHEET_ID = "YOUR_SHEET_ID_HERE"
RAW_COOKIE_STRING = """
PASTE_YOUR_COOKIE_STRING_HERE
"""

def set_cookies(driver):
    for part in RAW_COOKIE_STRING.strip().split(';'):
        if '=' in part:
            name, value = part.strip().split('=', 1)
            # Add to the root domain so it applies everywhere
            driver.add_cookie({'name': name, 'value': value, 'domain': '.mindtickle.com'})

# --- EXTRACTION LOGIC ---
def extract_recording_list(driver):
    # Base URL without redirecting logic (like a static asset) to set cookies
    driver.get("https://innovaccer.mindtickle.com/favicon.ico")
    time.sleep(2)
    set_cookies(driver)
    
    # Now go to the actual page
    driver.get(TARGET_URL)
    wait = WebDriverWait(driver, 30)
    time.sleep(10) # Initial load
    
    # DEBUG: Check if we are on the login page
    if "pitch.innovaccer" in driver.current_url or "login" in driver.current_url.lower():
        print(f"ERROR: Redirected to login page: {driver.current_url}")
        print("This means the cookies were invalid or expired. Please copy a fresh cookie string.")
        driver.save_screenshot("login_error.png")
        return {}

    # 1. Try to find the total count
    try:
        count_text = driver.find_element(By.XPATH, "//*[contains(text(), 'Showing')]").text
        total_target = int(''.join(filter(str.isdigit, count_text)))
        print(f"Targeting {total_target} recordings...")
    except:
        total_target = 1000 # Fallback
        print("Could not detect total count, will scroll until no new items appear.")

    unique_recordings = {}
    last_count = 0
    no_new_data_count = 0
    
    # 2. Iterative Collection & Scroll Loop
    while len(unique_recordings) < total_target:
        # Extract currently visible recordings
        links = driver.find_elements(By.CSS_SELECTOR, "a[href*='/new/ui/callai/recording/']")
        if not links:
            print("No links found on page. Check selectors or filters.")
            break
            
        for link in links:
            try:
                url = link.get_attribute("href")
                title = link.text.strip()
                if not title:
                    try: title = link.find_element(By.CSS_SELECTOR, "div div").text.strip()
                    except: pass
                
                if url and title and url not in unique_recordings:
                    unique_recordings[url] = title
            except:
                continue # Stale element catch
        
        current_count = len(unique_recordings)
        print(f"Collected {current_count}/{total_target}...")

        # Break if we've been stuck for too long
        if current_count == last_count:
            no_new_data_count += 1
            if no_new_data_count > 8: # Increased tolerance: Stop if 8 scrolls yield nothing
                print("No new recordings found after 8 scroll attempts. Finalizing...")
                break
        else:
            no_new_data_count = 0
        
        last_count = current_count
        
        # Robust Scroll Logic -> Scroll the very last loaded link into view
        try:
            last_element = links[-1]
            driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'end'});", last_element)
            
            # Wait longer for the API response. Some batches take 3-5 seconds to load.
            time.sleep(4) 
            
            # Additional small scroll to trigger the loader if scrollIntoView wasn't enough
            driver.execute_script("window.scrollBy(0, 300);")
            time.sleep(1)
        except Exception as e:
            print("Failed to scroll to last element, trying container scroll...")
            driver.execute_script("window.scrollBy(0, 1000);")
            time.sleep(4)

    return unique_recordings

# --- EXECUTION ---
driver = get_driver()
recordings = extract_recording_list(driver)
driver.quit()

# Write to Google Sheets
if recordings:
    sh = gc.open_by_key(SHEET_ID)
    worksheet = sh.get_worksheet(0)
    rows = [[title, url] for url, title in recordings.items()]
    worksheet.append_rows(rows)
    print(f"Done! Exported {len(rows)} recordings.")
else:
    print("No data was exported.")
```
