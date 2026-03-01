# Simplified Metadata Extraction (Feb 1 - Today)

Extract only the Title and Mindtickle URL for all recordings within the specified date range and export to Google Sheets.

## Proposed Changes

### Scraping Strategy
1. **Filter**: Set date range to Feb 1st, 2026 - Today.
2. **Extraction**: Capture `Title` and `URL` for each recording.
3. **Batching**: Update the Google Sheet after every 5 recordings processed.

### Google Sheets Integration
- Target Sheet: [Mindtickle Call AI Metadata](https://docs.google.com/spreadsheets/d/1HYg4YH9mQ9f7Mw67OR9LXiMB2Pc9yn0ORbZy-CBFn-U/edit?gid=0#gid=0)
- Columns: `Title`, `URL`

## Verification Plan
1. **Link Audit**: Verify that all extracted URLs are valid and point to the correct Mindtickle recordings.
2. **Batch Check**: Confirm that rows are appended correctly in groups of 5.
