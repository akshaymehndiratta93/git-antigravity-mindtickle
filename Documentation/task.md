# BrandLens Copilot - Task Checklist

## Planning
- [x] Analyze CSV data structure and field completeness
- [x] Study Apple-inspired design template from RFP Scanner
- [x] Write implementation plan
- [x] Get user approval on plan

## Data Processing
- [/] Create Python script to parse CSV and generate structured JSON per brand
- [ ] Cluster pain points, business impacts, growth signals via Gemini 2.5 Pro
- [ ] Generate pre-computed dashboard data (KPIs, distributions, clusters)
- [ ] Output `data/` folder with per-brand JSON + master summary

## Frontend - Core Infrastructure
- [ ] Create project structure: `index.html`, `index.css`, `app.js`
- [ ] Implement Apple-inspired design system (frosted nav, Inter font, pills)
- [ ] Build brand selector and conversational state management
- [ ] Implement tab navigation for 5 dashboards

## Frontend - Dashboard 1: Brand Overview
- [ ] KPI summary strip (Total Calls, Stage %, Budget Clarity, etc.)
- [ ] Stage distribution bar chart
- [ ] Top Pain Clusters section
- [ ] Top Business Impact Themes section
- [ ] Growth Signals section
- [ ] Qualification Health Snapshot
- [ ] Evidence call list with drill-down filters

## Frontend - Dashboard 2: Stage Intelligence
- [ ] Stage selector and pain themes
- [ ] Business Impact / Value Framing patterns
- [ ] Qualification gaps and risk signals
- [ ] Evidence table with follow-up actions

## Frontend - Dashboard 3: Account Health
- [ ] Relationship strength signals
- [ ] Engagement quality + customer wins
- [ ] Growth opportunities
- [ ] At-risk / high-growth account highlights

## Frontend - Dashboard 4: Qualification Health
- [ ] Budget / Timeline clarity distributions
- [ ] Key Players completeness
- [ ] Pain Clarity Score
- [ ] Risk summary callouts

## Frontend - Dashboard 5: Messaging & Positioning
- [ ] Repeated value propositions
- [ ] Inconsistent narratives
- [ ] Proof signals + content gaps

## AI Copilot (Q&A)
- [ ] Integrate Gemini 2.5 Pro via TrueFoundry API
- [ ] Build chat panel with conversational state
- [ ] Implement evidence-grounded response format
- [ ] Add suggested follow-up prompts

## Verification
- [ ] Visual review all 5 dashboards in browser
- [ ] Test brand switching and filter interactions
- [ ] Test AI copilot Q&A with sample questions
- [ ] Verify all evidence citations link to correct URLs
