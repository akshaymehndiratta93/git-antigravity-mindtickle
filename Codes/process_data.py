#!/usr/bin/env python3
"""
BrandLens Copilot — Data Processing Pipeline
Parses Mindtickle CSV, clusters insights via Gemini 2.5 Pro, outputs JSON for dashboards.
"""

import csv
import json
import os
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

from openai import OpenAI

# ─── Configuration ───────────────────────────────────────────────────────────
CSV_PATH = "./Raw_Data/Mindtickle Scraper.csv"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data"
EXCLUDED_BRANDS = {"Needs Strategic Review", "No Clear Fit", ""}

TF_API_KEY = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkdyR2VuTWlpWEhYREx4UlFPQ0otWXhBUXZtNCJ9.eyJhdWQiOiI2OTZlNmU2Zi03NjYxLTYzNjMtNjU3Mi0zYTY0MzIzNjY1NjMiLCJleHAiOjM3MzE1ODQwMjUsImlhdCI6MTc3MjAzMjAyNSwiaXNzIjoidHJ1ZWZvdW5kcnkuY29tIiwic3ViIjoiY21tMjY0NWhxNzN4aDAxbm00d2Q4Ym0wMSIsImp0aSI6ImNtbTI2NDVoczczeGkwMW5tZDRjYzh6ZzEiLCJzdWJqZWN0U2x1ZyI6ImRlZmF1bHQtY21tMjYzc2JoNXppajAxcWJmdjF5aGowdiIsInVzZXJuYW1lIjoiZGVmYXVsdC1jbW0yNjNzYmg1emlqMDFxYmZ2MXloajB2IiwidXNlclR5cGUiOiJzZXJ2aWNlYWNjb3VudCIsInN1YmplY3RUeXBlIjoic2VydmljZWFjY291bnQiLCJ0ZW5hbnROYW1lIjoiaW5ub3ZhY2NlciIsInJvbGVzIjpbXSwiand0SWQiOiJjbW0yNjQ1aHM3M3hpMDFubWQ0Y2M4emcxIiwiYXBwbGljYXRpb25JZCI6IjY5NmU2ZTZmLTc2NjEtNjM2My02NTcyLTNhNjQzMjM2NjU2MyJ9.Jdb2qq1alKSboc703Jp88GQYzEsEtGOdEYUvp8UcS5SYQ9p2KZtG7hAQbVMQEXotiDjnsOlPtX6N-nPSLVCPxteKYjG2D6vsdRokGYMoS6zIreP7uCpgrUZKtDLdxAtvFofM4TJCJMr1MqeYI6JnBZtlYbg4NiHBWEzuRBtNYrUWUaL7qMecq04aSfOdBSOlAUbydvgN1pz0bVcyHe6MTzzhnhs0EE3wZBuwHOfxe-el-Gu3YHAN476pK51k7ZwaywwS-fhFoS6WWQpXoU6BhsGovqQyn85dcZtXX-zJn5wDPQ-R2iudm_cglY0953AIxryA7lvWDYGnBafm6_bFXw"
TF_BASE_URL = "https://truefoundry.innovaccer.com/api/llm"
TF_MODEL = "analytics-genai/gemini-2-5-pro"

# ─── Helpers ─────────────────────────────────────────────────────────────────

client = OpenAI(api_key=TF_API_KEY, base_url=TF_BASE_URL)

def slugify(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')

def is_defined(text: str) -> bool:
    """Check if a field has meaningful content (not empty / 'Not discussed')."""
    if not text or not text.strip():
        return False
    lower = text.strip().lower()
    return lower not in ("not discussed", "not discussed.", "n/a", "none", "not mentioned", "not mentioned.")

def split_stages(stage_str: str) -> list:
    """Split comma-separated stage values into individual stages."""
    if not stage_str:
        return []
    return [s.strip() for s in stage_str.split(',') if s.strip()]

def call_gemini(prompt: str, max_tokens: int = 4000, max_retries: int = 3) -> str:
    """Call Gemini 2.5 Pro via TrueFoundry and return response text with retries."""
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are an analytical AI assistant. Always respond with valid JSON only, no markdown wrapping."},
                    {"role": "user", "content": prompt},
                ],
                model=TF_MODEL,
                max_tokens=max_tokens,
                stream=False,
                extra_headers={
                    "X-TFY-METADATA": '{}',
                    "X-TFY-LOGGING-CONFIG": '{"enabled": true}',
                },
            )
            content = response.choices[0].message.content
            if content and content.strip():
                return content.strip()
            
            print(f"  ⚠️  Empty response (attempt {attempt+1}/{max_retries})... retrying")
        except Exception as e:
            print(f"  ⚠️  Gemini API error (attempt {attempt+1}/{max_retries}): {e}")
            time.sleep(2 ** attempt)  # Exponential backoff
            
    print("  ❌ Failed after multiple retries.")
    return "{}"


# ─── CSV Parsing ─────────────────────────────────────────────────────────────

def parse_csv() -> list[dict]:
    """Parse the Mindtickle CSV into a list of normalized dicts."""
    rows = []
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Normalize keys (strip whitespace)
            normalized = {}
            for k, v in row.items():
                clean_key = k.strip()
                normalized[clean_key] = v.strip() if v else ""
            
            # Fix known column name variations
            if "Debrief - Account Health -Actions" in normalized:
                normalized["Debrief - Account Health - Actions"] = normalized.pop("Debrief - Account Health -Actions")
            
            rows.append(normalized)
    
    print(f"✅ Parsed {len(rows)} rows from CSV")
    return rows


# ─── Brand Grouping ─────────────────────────────────────────────────────────

def group_by_brand(rows: list[dict]) -> dict[str, list[dict]]:
    """Group rows by Brand Discussed, excluding non-brand values."""
    brands = defaultdict(list)
    for row in rows:
        brand = row.get("Brand Discussed", "").strip()
        if brand and brand not in EXCLUDED_BRANDS:
            brands[brand].append(row)
    
    print(f"✅ Grouped into {len(brands)} brands: {', '.join(f'{k} ({len(v)})' for k, v in sorted(brands.items(), key=lambda x: -len(x[1])))}")
    return dict(brands)


# ─── KPI Computation ────────────────────────────────────────────────────────

def compute_kpis(calls: list[dict]) -> dict:
    """Compute dashboard KPIs for a set of calls."""
    total = len(calls)
    if total == 0:
        return {}
    
    # Stage distribution (split multi-value stages)
    stage_counter = Counter()
    for c in calls:
        stages = split_stages(c.get("Opportunity Stage", ""))
        if stages:
            for s in stages:
                stage_counter[s] += 1
        else:
            stage_counter["Unknown"] += 1
    
    # Budget clarity
    budget_defined = sum(1 for c in calls if is_defined(c.get("Debrief - Deal Qualification - Pricing & Budget", "")))
    
    # Timeline clarity
    timeline_defined = sum(1 for c in calls if is_defined(c.get("Debrief - Deal Qualification - Timeline", "")))
    
    # Multi-threaded: calls with >2 key players or >3 attendees
    multi_threaded = 0
    for c in calls:
        key_players = c.get("Debrief - Deal Qualification - Key Players", "")
        attendees = c.get("Attendees", "")
        player_count = len([p for p in key_players.split(',') if p.strip()]) if key_players else 0
        attendee_count = len([a for a in attendees.split(',') if a.strip()]) if attendees else 0
        if player_count >= 2 or attendee_count >= 3:
            multi_threaded += 1
    
    # Growth signals
    growth_mentions = sum(1 for c in calls if is_defined(c.get("Debrief - Account Health - Growth Opportunities", "")))
    
    # Calls with data
    calls_with_summary = sum(1 for c in calls if is_defined(c.get("Summary", "")))
    calls_with_debrief = sum(1 for c in calls if is_defined(c.get("Debrief - Customer Pain Point - Current Situation", "")))
    
    return {
        "total_calls": total,
        "calls_with_summary": calls_with_summary,
        "calls_with_debrief": calls_with_debrief,
        "stage_distribution": dict(stage_counter.most_common()),
        "budget_clarity_rate": round(budget_defined / total * 100, 1),
        "budget_defined": budget_defined,
        "budget_undefined": total - budget_defined,
        "timeline_clarity_rate": round(timeline_defined / total * 100, 1),
        "timeline_defined": timeline_defined,
        "timeline_undefined": total - timeline_defined,
        "multi_threaded_rate": round(multi_threaded / total * 100, 1),
        "multi_threaded_count": multi_threaded,
        "growth_mention_rate": round(growth_mentions / total * 100, 1),
        "growth_mention_count": growth_mentions,
    }


# ─── Qualification Health per Stage ─────────────────────────────────────────

def compute_qualification_by_stage(calls: list[dict]) -> dict:
    """Compute budget/timeline/key-player clarity per stage."""
    stage_qual = defaultdict(lambda: {"total": 0, "budget_clear": 0, "timeline_clear": 0, "key_players_clear": 0})
    
    for c in calls:
        stages = split_stages(c.get("Opportunity Stage", ""))
        if not stages:
            stages = ["Unknown"]
        for stage in stages:
            stage_qual[stage]["total"] += 1
            if is_defined(c.get("Debrief - Deal Qualification - Pricing & Budget", "")):
                stage_qual[stage]["budget_clear"] += 1
            if is_defined(c.get("Debrief - Deal Qualification - Timeline", "")):
                stage_qual[stage]["timeline_clear"] += 1
            if is_defined(c.get("Debrief - Deal Qualification - Key Players", "")):
                stage_qual[stage]["key_players_clear"] += 1
    
    result = {}
    for stage, data in stage_qual.items():
        t = data["total"]
        result[stage] = {
            "total": t,
            "budget_clear_pct": round(data["budget_clear"] / t * 100, 1) if t > 0 else 0,
            "timeline_clear_pct": round(data["timeline_clear"] / t * 100, 1) if t > 0 else 0,
            "key_players_clear_pct": round(data["key_players_clear"] / t * 100, 1) if t > 0 else 0,
        }
    return result


# ─── Account-Level Health ────────────────────────────────────────────────────

def compute_account_health(calls: list[dict]) -> list[dict]:
    """Compute per-account health indicators."""
    accounts = defaultdict(list)
    for c in calls:
        opp = c.get("Opportunity Name", "").strip()
        if opp:
            accounts[opp].append(c)
    
    account_list = []
    for name, acalls in accounts.items():
        total = len(acalls)
        relationship_signals = sum(1 for c in acalls if is_defined(c.get("Debrief - Account Health - Key Relationships", "")))
        engagement_signals = sum(1 for c in acalls if is_defined(c.get("Debrief - Account Health - Customer Engagement", "")))
        wins = sum(1 for c in acalls if is_defined(c.get("Debrief - Account Health - Customer Wins", "")))
        growth = sum(1 for c in acalls if is_defined(c.get("Debrief - Account Health - Growth Opportunities", "")))
        budget_clear = sum(1 for c in acalls if is_defined(c.get("Debrief - Deal Qualification - Pricing & Budget", "")))
        
        # Health score: simple weighted average
        scores = []
        if total > 0:
            scores.append(relationship_signals / total)
            scores.append(engagement_signals / total)
            scores.append(budget_clear / total)
        health_score = round(sum(scores) / len(scores) * 100, 1) if scores else 0
        
        # Determine status
        if health_score >= 60:
            status = "healthy"
        elif health_score >= 30:
            status = "at_risk"
        else:
            status = "critical"
        
        account_list.append({
            "name": name,
            "call_count": total,
            "health_score": health_score,
            "status": status,
            "relationship_pct": round(relationship_signals / total * 100, 1) if total else 0,
            "engagement_pct": round(engagement_signals / total * 100, 1) if total else 0,
            "wins_count": wins,
            "growth_signals": growth,
            "budget_clarity_pct": round(budget_clear / total * 100, 1) if total else 0,
            "sr_nos": [c.get("Sr No.", "") for c in acalls],
        })
    
    account_list.sort(key=lambda x: -x["health_score"])
    return account_list


# ─── Extract Call Evidence List ──────────────────────────────────────────────

def build_call_list(calls: list[dict]) -> list[dict]:
    """Build a compact call evidence list for the frontend."""
    result = []
    for c in calls:
        sr_no = c.get("Sr No.", "")
        title = c.get("Title", "")
        url = c.get("URL", "")
        if not title and not url:
            continue
        
        stages = split_stages(c.get("Opportunity Stage", ""))
        
        result.append({
            "sr_no": sr_no,
            "title": title or f"Call #{sr_no}",
            "url": url,
            "stages": stages,
            "opportunity": c.get("Opportunity Name", ""),
            "attendees": c.get("Attendees", ""),
            "brand": c.get("Brand Discussed", ""),
            "summary": c.get("Summary", "")[:300],
            "has_budget": is_defined(c.get("Debrief - Deal Qualification - Pricing & Budget", "")),
            "has_timeline": is_defined(c.get("Debrief - Deal Qualification - Timeline", "")),
            "has_growth": is_defined(c.get("Debrief - Account Health - Growth Opportunities", "")),
        })
    return result


# ─── LLM-Based Clustering ───────────────────────────────────────────────────

def cluster_text_field(calls: list[dict], field: str, category_label: str, max_items: int = 50) -> list[dict]:
    """Use Gemini to cluster free-text field values into themes."""
    texts = []
    for c in calls:
        val = c.get(field, "").strip()
        if is_defined(val):
            texts.append({"sr_no": c.get("Sr No.", ""), "text": val[:500]})
    
    if len(texts) < 3:
        print(f"  ℹ️  Skipping clustering for {category_label}: only {len(texts)} entries")
        return []
    
    # Limit to max_items for token efficiency
    sample = texts[:max_items]
    
    prompt = f"""Analyze the following {len(sample)} sales call excerpts under the category "{category_label}".

Cluster them into 5-8 distinct thematic groups. For each cluster, provide:
- "theme": a concise 3-6 word label
- "description": one sentence explaining the pattern
- "count": how many excerpts belong to this cluster
- "representative_sr_nos": list of 2-3 Sr No. values that best represent this theme
- "stage_distribution": if apparent from context, note which deal stages this appears in

Return ONLY a JSON array of cluster objects. No markdown.

Excerpts:
{json.dumps(sample, indent=2)}"""

    raw = call_gemini(prompt)
    
    # Parse JSON (handle potential markdown wrapping)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r'^```\w*\n?', '', raw)
        raw = re.sub(r'\n?```$', '', raw)
    
    try:
        clusters = json.loads(raw)
        if isinstance(clusters, list):
            print(f"  ✅ Clustered {category_label}: {len(clusters)} themes from {len(sample)} entries")
            return clusters
    except json.JSONDecodeError as e:
        print(f"  ⚠️  JSON parse error for {category_label}: {e}")
    
    return []


def cluster_business_impacts(calls: list[dict]) -> dict:
    """Cluster business impacts into predefined categories."""
    texts = []
    for c in calls:
        val = c.get("Debrief - Customer Pain Point - Business Impact", "").strip()
        if is_defined(val):
            texts.append({"sr_no": c.get("Sr No.", ""), "text": val[:500]})
    
    if len(texts) < 3:
        return {"categories": {}, "total_analyzed": len(texts)}
    
    sample = texts[:50]
    
    prompt = f"""Analyze these {len(sample)} "Business Impact" excerpts from sales calls.

Categorize each into one or more of these categories:
- Cost (financial/budget impact)
- Time (efficiency/speed impact)
- Revenue (revenue/growth impact)  
- Risk (compliance/risk impact)
- Operational (process/workflow impact)
- Patient/Customer Experience

For each category, provide:
- "count": number of excerpts
- "key_themes": 2-3 recurring sub-themes
- "is_quantified_pct": estimated % where the impact is quantified with numbers
- "representative_sr_nos": 2-3 best example Sr No. values

Return as a JSON object where keys are category names. No markdown wrapping.

Excerpts:
{json.dumps(sample, indent=2)}"""

    raw = call_gemini(prompt)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r'^```\w*\n?', '', raw)
        raw = re.sub(r'\n?```$', '', raw)
    
    try:
        result = json.loads(raw)
        if isinstance(result, dict):
            print(f"  ✅ Categorized business impacts: {len(result)} categories")
            return {"categories": result, "total_analyzed": len(sample)}
    except json.JSONDecodeError:
        pass
    
    return {"categories": {}, "total_analyzed": len(texts)}


def extract_value_propositions(calls: list[dict]) -> list[dict]:
    """Extract recurring value propositions from Summary + Value of Solving."""
    texts = []
    for c in calls:
        summary = c.get("Summary", "").strip()
        value = c.get("Debrief - Customer Pain Point - Value of Solving", "").strip()
        combined = ""
        if is_defined(summary):
            combined += summary[:300]
        if is_defined(value):
            combined += " | " + value[:300]
        if combined:
            texts.append({"sr_no": c.get("Sr No.", ""), "text": combined})
    
    if len(texts) < 3:
        return []
    
    sample = texts[:40]
    
    prompt = f"""Analyze these {len(sample)} sales call summaries & value propositions.

Identify:
1. "repeated_value_props": Top 5-8 recurring value propositions (theme + frequency + representative Sr Nos)
2. "inconsistent_narratives": Any 2-3 cases where positioning conflicts across calls (describe the conflict + Sr Nos)
3. "proof_signals": Types of evidence/proof points referenced (case studies, metrics, testimonials) + Sr Nos
4. "content_gaps": Repeated questions or requests that suggest missing sales assets + Sr Nos

Return as a JSON object with these 4 keys. Each should be an array of objects. No markdown.

Excerpts:
{json.dumps(sample, indent=2)}"""

    raw = call_gemini(prompt)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r'^```\w*\n?', '', raw)
        raw = re.sub(r'\n?```$', '', raw)
    
    try:
        result = json.loads(raw)
        if isinstance(result, dict):
            print(f"  ✅ Extracted messaging intelligence")
            return result
    except json.JSONDecodeError:
        pass
    
    return {}


# ─── Build Full Brand Data ──────────────────────────────────────────────────

def build_brand_data(brand: str, calls: list[dict]) -> dict:
    """Build complete dashboard data for a single brand."""
    print(f"\n{'='*60}")
    print(f"Processing brand: {brand} ({len(calls)} calls)")
    print(f"{'='*60}")
    
    # 1. KPIs
    print("  Computing KPIs...")
    kpis = compute_kpis(calls)
    
    # 2. Qualification by stage
    print("  Computing qualification by stage...")
    qual_by_stage = compute_qualification_by_stage(calls)
    
    # 3. Account health
    print("  Computing account health...")
    account_health = compute_account_health(calls)
    
    # 4. Call evidence list
    print("  Building call list...")
    call_list = build_call_list(calls)
    
    # 5. LLM clustering (with rate limiting)
    print("  Clustering pain points...")
    pain_clusters = cluster_text_field(
        calls,
        "Debrief - Customer Pain Point - Problems & Challenges",
        "Pain Points & Challenges"
    )
    time.sleep(1)
    
    print("  Clustering deal qualification pain points...")
    deal_pain_clusters = cluster_text_field(
        calls,
        "Debrief - Deal Qualification - Pain Points",
        "Deal Qualification Pain Points"
    )
    time.sleep(1)
    
    print("  Categorizing business impacts...")
    business_impacts = cluster_business_impacts(calls)
    time.sleep(1)
    
    print("  Clustering growth opportunities...")
    growth_clusters = cluster_text_field(
        calls,
        "Debrief - Account Health - Growth Opportunities",
        "Growth Opportunities"
    )
    time.sleep(1)
    
    print("  Extracting messaging intelligence...")
    messaging = extract_value_propositions(calls)
    time.sleep(1)
    
    # 6. Risk signals
    print("  Identifying risk patterns...")
    # Identify late-stage deals missing budget/key players
    risk_signals = []
    late_stages = {"X3 - VOC & Contracting", "X2 - Shortlisted (Not a VOC)", "X4 – Closed Won (Contract Executed)"}
    for c in calls:
        stages = split_stages(c.get("Opportunity Stage", ""))
        is_late = any(s in late_stages for s in stages)
        if is_late:
            if not is_defined(c.get("Debrief - Deal Qualification - Pricing & Budget", "")):
                risk_signals.append({
                    "type": "late_stage_no_budget",
                    "sr_no": c.get("Sr No.", ""),
                    "title": c.get("Title", ""),
                    "stages": stages,
                    "url": c.get("URL", ""),
                })
            if not is_defined(c.get("Debrief - Deal Qualification - Key Players", "")):
                risk_signals.append({
                    "type": "late_stage_no_key_players",
                    "sr_no": c.get("Sr No.", ""),
                    "title": c.get("Title", ""),
                    "stages": stages,
                    "url": c.get("URL", ""),
                })
    
    return {
        "brand": brand,
        "slug": slugify(brand),
        "kpis": kpis,
        "qualification_by_stage": qual_by_stage,
        "account_health": account_health,
        "call_list": call_list,
        "pain_clusters": pain_clusters,
        "deal_pain_clusters": deal_pain_clusters,
        "business_impacts": business_impacts,
        "growth_clusters": growth_clusters,
        "messaging": messaging,
        "risk_signals": risk_signals,
    }


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print("🚀 BrandLens Copilot — Data Processing Pipeline")
    print(f"   CSV: {CSV_PATH}")
    print(f"   Output: {OUTPUT_DIR}")
    print()
    
    # Parse CSV
    rows = parse_csv()
    
    # Group by brand
    brand_groups = group_by_brand(rows)
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Process each brand
    brands_summary = []
    all_calls = []
    
    for brand, calls in sorted(brand_groups.items(), key=lambda x: -len(x[1])):
        brand_data = build_brand_data(brand, calls)
        
        # Save per-brand JSON
        slug = brand_data["slug"]
        brand_file = OUTPUT_DIR / f"{slug}.json"
        with open(brand_file, 'w', encoding='utf-8') as f:
            json.dump(brand_data, f, indent=2, ensure_ascii=False)
        print(f"  💾 Saved {brand_file.name}")
        
        # Add to summary
        brands_summary.append({
            "brand": brand,
            "slug": slug,
            "total_calls": len(calls),
            "budget_clarity_rate": brand_data["kpis"]["budget_clarity_rate"],
            "timeline_clarity_rate": brand_data["kpis"]["timeline_clarity_rate"],
            "growth_mention_rate": brand_data["kpis"]["growth_mention_rate"],
        })
        
        # Collect all calls for copilot
        all_calls.extend(brand_data["call_list"])
    
    # Save brands summary
    summary_file = OUTPUT_DIR / "brands_summary.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump({
            "brands": brands_summary,
            "total_calls": len(rows),
            "total_with_brand": sum(b["total_calls"] for b in brands_summary),
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }, f, indent=2)
    print(f"\n💾 Saved {summary_file.name}")
    
    # Save all calls for copilot context
    calls_file = OUTPUT_DIR / "calls.json"
    with open(calls_file, 'w', encoding='utf-8') as f:
        json.dump(all_calls, f, indent=2, ensure_ascii=False)
    print(f"💾 Saved {calls_file.name}")
    
    # Also save a full-detail calls file for copilot deep-dives
    full_calls = []
    for brand, calls in brand_groups.items():
        for c in calls:
            if c.get("Title") or c.get("URL"):
                full_calls.append(c)
    
    full_calls_file = OUTPUT_DIR / "calls_full.json"
    with open(full_calls_file, 'w', encoding='utf-8') as f:
        json.dump(full_calls, f, indent=2, ensure_ascii=False)
    print(f"💾 Saved {full_calls_file.name}")
    
    print(f"\n✅ Done! Processed {len(brands_summary)} brands, {len(all_calls)} calls.")
    print(f"   Output directory: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
