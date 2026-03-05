import json, sys
sys.path.append('Codes')
from process_data import call_gemini, parse_csv, INNOVACCER_BRANDS

rows = parse_csv()
batch = rows[:5] # Just 5 rows
data_to_classify = []
for r in batch:
    data_to_classify.append({
        "Sr No.": r.get("Sr No."),
        "Context": r.get("Debrief - Deal Qualification - Pain Points", "").strip() or r.get("Summary", "")[:300]
    })

prompt_template = """You are a healthcare AI product expert for Innovaccer.
Analyze the following sales call excerpts (primarily pain points).
For each call, determine the MOST LIKELY Innovaccer brand being discussed.

You must choose EXACTLY ONE from this list: {brand_list}

Definitions:
- Gravity: Data Platform / CDAP / Foundation
- Comet: Patient Access / Access Center / Contact Center
- Flow: Revenue Cycle / Workflows / Care Management automation
- Atlas: Population Health OS / Patient Relationship CRM
- Story Health: Specialty Care Management (Cardiology, etc)
- Cured: Healthcare CRM / Marketing & Campaigns
- Humbi: Actuarial analytics / Risk Management / VBC Analytics
- Galaxy: Payer platform / Risk adjustment / HEDIS compliance
- PQS: Pharmacy Quality Solutions / Payer-Pharmacy performance
- Unknown: If there is absolutely no signal to determine the product.

Return a JSON object where the keys are the "Sr No." and the values are the exact brand name string from the list above. No markdown wrapping.

Excerpts:
{batch_json}
"""

prompt = prompt_template.format(
    brand_list=", ".join(INNOVACCER_BRANDS),
    batch_json=json.dumps(data_to_classify, indent=2)
)

print("Prompt length:", len(prompt))
print("Calling API...")
raw = call_gemini(prompt, max_tokens=1500, max_retries=1)
print("Raw response:")
print(repr(raw))
