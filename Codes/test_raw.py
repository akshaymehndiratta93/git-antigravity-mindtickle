import json
import sys
sys.path.append('Codes')
from process_data import call_gemini, parse_csv, INNOVACCER_BRANDS, client

rows = parse_csv()
batch = rows[:20]
data_to_classify = []
for r in batch:
    data_to_classify.append({
        "Sr No.": r.get("Sr No."),
        "Context": r.get("Debrief - Deal Qualification - Pain Points", "").strip() or r.get("Summary", "")[:300]
    })

prompt_template = """You are a healthcare AI product expert for Innovaccer.
Analyze the following sales call excerpts.
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

print("Calling API...")
try:
    response = client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You are an analytical AI assistant. Always respond with valid JSON only, no markdown wrapping."},
            {"role": "user", "content": prompt},
        ],
        model="analytics-genai/gemini-2-5-pro",
        max_tokens=1500,
        stream=False,
        extra_headers={
            "X-TFY-METADATA": '{}',
            "X-TFY-LOGGING-CONFIG": '{"enabled": true}',
            "User-Agent": "Mozilla/5.0",
        },
    )
    print(f"Finish Reason: {response.choices[0].finish_reason}")
    print(f"Message content: {repr(response.choices[0].message.content)}")
    print(f"Full response object: {response}")
except Exception as e:
    print(f"Exception: {e}")
