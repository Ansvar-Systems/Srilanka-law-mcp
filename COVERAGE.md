# Coverage Index -- Sri Lanka Law MCP

> Auto-generated from census data. Do not edit manually.
> Generated: 2026-02-27

## Source

| Field | Value |
|-------|-------|
| Authority | Commonwealth Legal Information Institute (CommonLII) |
| Portal | [commonlii.org/lk](https://www.commonlii.org/lk/) |
| License | Government Open Data |
| Census date | 2026-02-27 |

## Summary

| Metric | Count |
|--------|-------|
| Total laws enumerated | 2,570 |
| Numbered Acts (ingestable) | 2,054 |
| Consolidated Acts (excluded, PDF-only) | 516 |
| Ingested so far | 126 |
| Provisions extracted | 1,888 |
| Definitions extracted | 124 |
| Database size | 3.1 MB |
| **Coverage** | **6% of numbered acts (ingestion ongoing)** |

### Databases

| Database | Count | Period | Status |
|----------|-------|--------|--------|
| Numbered Acts (num_act) | 2,054 | 1956-2006 | Ingestable (HTML section-per-page) |
| Consolidated Acts (consol_act) | 516 | 1980 Revised Edition | Excluded (PDF/OCR only) |

### Notes

- CommonLII hosts two databases of Sri Lankan legislation
- Numbered Acts provide structured HTML with individual section pages -- this is the primary ingestion source
- Consolidated Acts redirect to PDF downloads (not suitable for automated text extraction)
- The CommonLII database was last updated in 2009 (numbered acts) and 2005 (consolidated acts)
- Sri Lanka legislates primarily in English, so text extraction is straightforward
- Ingestion is resumable: run `npm run ingest` to continue from where it stopped
- Each act requires 1 TOC request + N section requests (one per section), at 500ms rate limiting
- Full ingestion of all 2,054 numbered acts requires approximately 6-8 hours due to the per-section fetching approach
- The SSL certificate for commonlii.org has issues; the fetcher disables SSL verification

### Coverage by Letter (Numbered Acts)

| Letter | Acts |
|--------|------|
| A | 151 |
| B | 83 |
| C | 268 |
| D | 62 |
| E | 83 |
| F | 99 |
| G | 37 |
| H | 30 |
| I | 132 |
| J | 20 |
| K | 20 |
| L | 93 |
| M | 134 |
| N | 115 |
| O | 12 |
| P | 186 |
| Q | 1 |
| R | 97 |
| S | 232 |
| T | 108 |
| U | 23 |
| V | 20 |
| W | 34 |
| Y | 13 |
| Z | 1 |
