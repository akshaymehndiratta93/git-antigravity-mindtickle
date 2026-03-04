# BrandLens Copilot | Project Repository

This repository contains the AI-powered intelligence platform for Mindtickle sales call analysis.

## Project Structure

- **`/frontend`**: The Apple-inspired dashboard application.
  - `index.html`: Main dashboard UI with 5 integrated views.
  - `index.css`: Premium design system (frosted glass, Inter font, animations).
  - `app.js`: Core dashboard logic and rendering.
  - `copilot.js`: AI Q&A integration (Gemini 2.5 Pro via TrueFoundry).
  - `data/`: Brand-specific JSON data files.
- **`/Codes`**: Data processing scripts.
  - `process_data.py`: Pre-processing pipeline that parses CSV, computes KPIs, and clusters themes via Gemini.
- **`/Data`**: Raw datasets (Mindtickle Scraper CSV).
- **`/Documentation`**: Project plans, architecture diagrams, and task tracking.
- **`/Walkthrough`**: Proof-of-work documentation and screenshots.

## Getting Started

1. **Pre-process Data**:
   ```bash
   python3 Codes/process_data.py
   ```
2. **Launch Dashboard**:
   > [!IMPORTANT]
   > Opening `index.html` directly in your browser will NOT work due to security restrictions (CORS). You must use a local server.
   
   ```bash
   cd frontend
   python3 -m http.server 8888
   ```
3. **Access**:
   - **Local**: Open **[http://localhost:8888](http://localhost:8888)**
   - **Web**: **[Live Dashboard URL](https://akshaymehndiratta93.github.io/git-antigravity-mindtickle/)**

## Deployment
This project is set up for GitHub Pages. To push your local changes and make them live, run:
```bash
git push origin main
```

The integrated copilot provides evidence-grounded answers. It automatically builds context from the active brand's call data and cites specific Sr Nos. and URLs for every claim.
