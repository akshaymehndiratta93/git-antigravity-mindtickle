# Mindtickle Metadata Scraper for Google Colab

This script allows you to extract exhaustive metadata (Title, Attendees, Summary, Debrief, Scorecard, and Call Stats) from a list of Mindtickle recording URLs.

### **Prerequisites**
1.  **Google Colab**: Open [Google Colab](https://colab.research.google.com/) and create a new notebook.
2.  **Cookies**: Simply copy the cookie string from your browser (Network tab > Cookie header).
3.  **Google Sheet**: Create a new Google Sheet and copy its ID from the URL.

---

### **Step 1: Install Dependencies & Setup Selenium**
Copy and run this cell first to set up the environment.

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
from IPython.display import Image, display
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Setup Chrome Options for Colab
chrome_options = Options()
chrome_options.add_argument('--headless')
chrome_options.add_argument('--no-sandbox')
chrome_options.add_argument('--disable-dev-shm-usage')
chrome_options.add_argument('--window-size=2560,1440') # Force 2K layout
chrome_options.add_argument('--force-device-scale-factor=0.8') # Zoom out slightly

def get_driver():
    # Automatically manages and installs the correct ChromeDriver version
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=chrome_options)

# Authenticate Google Sheets
auth.authenticate_user()
creds, _ = default()
gc = gspread.authorize(creds)
```

---

### **Step 2: Configuration & Extraction Logic**
Update the `SHEET_ID` and `RECORDING_URLS` below.

```python
# --- CONFIGURATION ---
SHEET_ID = "YOUR_SHEET_ID_HERE"
# Paste your raw cookie string here (e.g., "_csrf-prod-us=...; mts-us-east-1=...")
RAW_COOKIE_STRING = """
PASTE_YOUR_COOKIE_STRING_HERE
"""

# The script will automatically fetch URLs from Column B of your provided Google Sheet.
# Make sure your Google Sheet has "Title" in Column A and "URL" in Column B.

def set_cookies(driver):
    for part in RAW_COOKIE_STRING.strip().split(';'):
        if '=' in part:
            name, value = part.strip().split('=', 1)
            driver.add_cookie({'name': name, 'value': value, 'domain': '.mindtickle.com'})

# --- SCRAPER LOGIC ---
def extract_metadata(driver, url):
    driver.get(url)
    wait = WebDriverWait(driver, 20)
    print("  Waiting 10s for heavy Mindtickle SPA to load...")
    time.sleep(10)  # Let SPA load fully
    
    # Zoom out via JavaScript just in case the CSS scaling isn't enough
    try:
        driver.execute_script("document.body.style.zoom='75%'")
    except: pass
    
    # DEBUG: Take a snapshot of the page right after loading!
    driver.save_screenshot("page_load.png")
    print("  => Saved 'page_load.png'. You can view it in Colab's left-side file folder.")
    
    metadata = {}
    
    # DEBUG: Check if we got redirected to login
    if "pitch.innovaccer" in driver.current_url or "login" in driver.current_url.lower():
        print(f"  ERROR: Redirected to login page. Your cookie might be expired!")
        driver.save_screenshot("login_error.png")
        return metadata

    try:
        # 0. Title Fallback Logic
        try:
            # Gentle wait for body to signify load, rather than a specific header class
            try: wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "body")))
            except: pass
            
            title_selectors = [
                "div.cai-breadcrumb + span",
                ".header-left-section > span:not(.recording-date):last-of-type",
                ".header-left-section span",
                ".recordingNameBlock span",
                "h1",
                "h2",
                "span[title]"  # Sometimes injected with the full name
            ]
            
            metadata["Title"] = "Title Not Found"
            
            for sel in title_selectors:
                try:
                    elements = driver.find_elements(By.CSS_SELECTOR, sel)
                    for el in elements:
                        text = el.text.split('\n')[0].strip()
                        # Mindtickle recordings usually have '<>' or are sufficiently long
                        if text and len(text) > 3:
                            metadata["Title"] = text
                            break
                    if metadata["Title"] != "Title Not Found":
                        break
                except: pass
                
            # Fallback 1: Look for any strong text indicator, like '<>'
            if metadata["Title"] == "Title Not Found":
                try:
                    spans = driver.find_elements(By.CSS_SELECTOR, "span")
                    for s in spans:
                        text = s.text.split('\n')[0].strip()
                        if "<>" in text:
                            metadata["Title"] = text
                            break
                except: pass
                
            # Fallback 2: Grab it straight from the browser's Tab Name!
            if metadata["Title"] == "Title Not Found":
                try:
                    page_title = driver.title
                    if page_title:
                        metadata["Title"] = page_title.replace("Mindtickle", "").strip(" -|")
                except: pass
                
            if metadata["Title"] == "Title Not Found" or metadata["Title"] == "":
                print("  WARNING: Could not find recording Title! Saving 'debug_error.png'")
                driver.save_screenshot("debug_error.png")
        except Exception as e: 
            metadata["Title"] = "Title Not Found"
            print(f"  WARNING: Title extraction completely failed! ({e}) Saving 'debug_error.png'")
            driver.save_screenshot("debug_error.png")

        # --- 0. EXTRACT RAW PAGE TEXT ---
        page_text = driver.execute_script("return document.body.innerText;")
        if not page_text: page_text = ""

        # --- 1. ATTENDEES (Regex from Timeline Percentages) ---
        import re
        attendees = re.findall(r'(.+)\n\d+%', page_text)
        if attendees:
            metadata["Attendees"] = ", ".join(list(set([a.strip() for a in attendees if a.strip() and "Themes timeline" not in a])))
        else:
            metadata["Attendees"] = "N/A"

        # HELPER: Click any span/div exactly matching text
        def native_click(text_target):
            try:
                clicked = driver.execute_script(f"""
                    var els = Array.from(document.querySelectorAll('*'));
                    var target = els.find(e => e.innerText && e.innerText.trim() === '{text_target}' && e.children.length === 0);
                    if (target) {{ target.click(); return true; }}
                    
                    // Fallback to less strict
                    target = els.find(e => e.innerText && e.innerText.trim() === '{text_target}' && e.tagName !== 'P');
                    if (target) {{ target.click(); return true; }}
                    return false;
                """)
                return clicked
            except: return False

        # HELPER: Slice Payload Payload
        def pull_ai_payload(raw_text):
            if not raw_text: return "N/A"
            payload = raw_text
            
            # Slice TOP
            if "Transcript\\n" in raw_text:
                payload = raw_text.split("Transcript\\n", 1)[-1]
            elif "Key moments\\n" in raw_text:
                payload = raw_text.split("Key moments\\n", 1)[-1]
                
            # Slice BOTTOM
            endings = ["\\nGenerated by Copilot", "Generated by Copilot", "\\nPublic comments", "\\nStart a conversation"]
            for end in endings:
                if end in payload:
                    payload = payload.split(end, 1)[0]
                    
            res = payload.strip()
            return res if len(res) > 5 else "N/A"

        # --- 2. SUMMARY ---
        metadata["Summary"] = "N/A"
        try:
            native_click("Summary")
            time.sleep(2.5)
            new_text = driver.execute_script("return document.body.innerText;")
            parsed = pull_ai_payload(new_text)
            if parsed != "N/A": 
                metadata["Summary"] = parsed
            else:
                # If clicking didn't change it, maybe it loaded by default
                metadata["Summary"] = pull_ai_payload(page_text)
        except: pass

        # --- 3. DEBRIEFS ---
        metadata["Debrief - Account Health"] = "N/A"
        metadata["Debrief - Customer Pain Point"] = "N/A"
        metadata["Debrief - Deal Qualification"] = "N/A"
        try:
            if native_click("Debrief"):
                time.sleep(2.5)
                
                # Account Health is the default. Extract it first!
                deb_text1 = driver.execute_script("return document.body.innerText;")
                parsed1 = pull_ai_payload(deb_text1)
                metadata["Debrief - Account Health"] = parsed1 if parsed1 != "N/A" else ""

                current_option_text = "Account Health Review"

                def click_debrief_dropdown(target_name):
                    nonlocal current_option_text
                    try:
                        # 1. Force the dropdown component to mount its options.
                        driver.execute_script("""
                            // Find the Ant Design dropdown wrappers
                            var drops = Array.from(document.querySelectorAll('.cai-select-selector, .cai-select, .framework-selection, .framework-select'));
                            
                            // Synthesize real mouse events (React often ignores plain .click() and listens to raw mousedowns)
                            drops.forEach(d => {
                                try {
                                    d.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                                    d.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                                    d.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                                } catch(e) {}
                            });
                        """)
                        time.sleep(1)
                        
                        # 2. Click the specific option we actually want from the popped-up list
                        clicked = driver.execute_script(f"""
                            var opts = Array.from(document.querySelectorAll('*'))
                                        .filter(e => e.children.length === 0 && e.textContent && e.textContent.toLowerCase().includes('{target_name.lower()}'));
                            // Attempt to click all matching hidden/visible elements to force selection
                            var success = false;
                            for(var i = opts.length - 1; i >= 0; i--) {{
                                try {{ 
                                    // Also dispatch real mouse events to the options!
                                    opts[i].dispatchEvent(new MouseEvent('mousedown', {{ bubbles: true, cancelable: true, view: window }}));
                                    opts[i].dispatchEvent(new MouseEvent('click', {{ bubbles: true, cancelable: true, view: window }}));
                                    opts[i].click(); 
                                    success = true; 
                                }} catch(e) {{}}
                            }}
                            return success;
                        """)
                        
                        if clicked:
                            time.sleep(2.5)
                            new_t = driver.execute_script("return document.body.innerText;")
                            res = pull_ai_payload(new_t)
                            if res != "N/A": 
                                current_option_text = target_name # Update what the combo box says now
                                return res
                    except: pass
                    return "N/A"

                res2 = click_debrief_dropdown("Customer Pain Point")
                if res2 != "N/A" and res2 != metadata["Debrief - Account Health"]:
                    metadata["Debrief - Customer Pain Point"] = res2

                res3 = click_debrief_dropdown("Deal Qualification")
                if res3 != "N/A" and res3 != metadata["Debrief - Customer Pain Point"] and res3 != metadata["Debrief - Account Health"]:
                    metadata["Debrief - Deal Qualification"] = res3
        except: pass

        # --- 4. SCORECARD ---
        try:
            score = driver.execute_script("""
                var s = document.querySelector('.score-percentage, [class*="scoreCard"] [class*="score"]');
                return s ? s.innerText.trim() : "";
            """)
            metadata["Scorecard Overall"] = score if score else "N/A"
        except: metadata["Scorecard Overall"] = "N/A"

        # --- 5. TRANSCRIPT (Ignored per user) ---
        metadata["Transcript"] = "N/A"
        
        # DEBUG BACKUP: If everything is N/A, save the DOM so you can inspect it!
        if metadata["Summary"] == "N/A" and metadata["Debrief - Customer Pain Point"] == "N/A":
            print(f"  WARNING: Content extraction parsing missed for {url}")
            driver.save_screenshot("final_state.png")
            try:
                debug_dom = driver.execute_script("var c = document.querySelector('.copilot-content'); return c ? c.innerHTML : document.body.innerHTML;")
                with open("debug_dom_output.txt", "w", encoding="utf-8") as f: f.write(debug_dom)
                print("  WARNING: All AI data was N/A. Saved 'debug_dom_output.txt' with the page HTML.")
            except: pass

    except Exception as e:
        print(f"Error processing {url}: {e}")
        
    return metadata

# --- MAIN EXECUTION ---
sh = gc.open_by_key(SHEET_ID)
worksheet = sh.get_worksheet(0)

headers = ["Title", "URL", "Attendees", "Summary", "Debrief - Account Health", "Debrief - Customer Pain Point", "Debrief - Deal Qualification", "Scorecard Overall", "Transcript"]

# Ensure headers are set properly
worksheet.update('A1:I1', [headers])

# Fetch URLs from Column B (Index 2 in gspread)
recording_urls = worksheet.col_values(2)[1:] # Skip header

if not recording_urls:
    print("No URLs found in Column B of the Google Sheet!")

driver = get_driver()
# Go to static asset to establish domain without trigerring IdP redirect
driver.get("https://innovaccer.mindtickle.com/favicon.ico")
time.sleep(2)
set_cookies(driver)

for i, url in enumerate(recording_urls):
    if not url.startswith("http"):
        continue
        
    row_num = i + 2 # Since row 1 is headers and Python is 0-indexed
    
    # Optional: Skip already processed rows (if column C has data)
    row_data = worksheet.row_values(row_num)
    if len(row_data) >= 3 and row_data[2].strip() != "":
         print(f"Skipping row {row_num}, already processed.")
         continue
    
    print(f"Processing ({i+1}/{len(recording_urls)}): {url}")
    data = extract_metadata(driver, url)
    
    if data:
        update_values = [
            data.get("Title", "N/A"),
            url, # Keep URL in Column B
            data.get("Attendees", "N/A"),
            data.get("Summary", "N/A"),
            data.get("Debrief - Account Health", "N/A"),
            data.get("Debrief - Customer Pain Point", "N/A"),
            data.get("Debrief - Deal Qualification", "N/A"),
            data.get("Scorecard Overall", "N/A"),
            data.get("Transcript", "N/A")
        ]
        
        # Update columns A through I for the current row
        worksheet.update(f'A{row_num}:I{row_num}', [update_values])
        time.sleep(2) # Prevent Google Sheets API rate limits

# --- VISUAL DEBUGGING ---
# Save and display a screenshot of the very last page it processed
driver.save_screenshot("final_state.png")
print("\n--- VISUAL DEBUG: What Colab is Seeing ---")
try: display(Image("final_state.png", width=800))
except: pass

driver.quit()
print("Done! All metadata added to Google Sheet.")
```

---

### **How to Use**
1.  **Inject Cookies**: The script relies on your active session. You **must** populate the `COOKIES_JSON` variable with the JSON output from your browser session.
2.  **Run in Batches**: If processing 200+ URLs, it is recommended to run in groups of 20-30 to avoid session timeouts in Colab.
3.  **Selector Stability**: Mindtickle occasionally updates its UI classes. If the script fails, inspect the page elements and update the CSS selectors in the `extract_metadata` function.
