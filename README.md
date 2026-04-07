# Sri Lanka Law MCP Server

**The LawNet Sri Lanka alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fsrilanka-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/srilanka-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/Srilanka-law-mcp?style=social)](https://github.com/Ansvar-Systems/Srilanka-law-mcp)
[![CI](https://github.com/Ansvar-Systems/Srilanka-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Srilanka-law-mcp/actions/workflows/ci.yml)
[![Provisions](https://img.shields.io/badge/provisions-32%2C790-blue)](https://github.com/Ansvar-Systems/Srilanka-law-mcp)

Query **2,055 Sri Lankan laws** -- from the Personal Data Protection Act No. 9 of 2022 and the Penal Code to the Companies Act No. 7 of 2007, Termination of Employment Act, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Sri Lankan legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Sri Lankan legal research means navigating lawnet.gov.lk, parliament.lk, and commonlii.org across a body of legislation spanning the colonial-era Ordinances, post-independence Acts, and recent digital-era statutes. Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking obligations under the Personal Data Protection Act No. 9 of 2022
- A **legal tech developer** building tools on Sri Lankan law
- A **researcher** tracing legislative history across 2,055 Acts and Ordinances

...you shouldn't need dozens of browser tabs and manual cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Sri Lankan law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://mcp.ansvar.eu/law-lk/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add srilanka-law --transport http https://mcp.ansvar.eu/law-lk/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "srilanka-law": {
      "type": "url",
      "url": "https://mcp.ansvar.eu/law-lk/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "srilanka-law": {
      "type": "http",
      "url": "https://mcp.ansvar.eu/law-lk/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/srilanka-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "srilanka-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/srilanka-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "srilanka-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/srilanka-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"What does the Personal Data Protection Act No. 9 of 2022 say about consent?"*
- *"Find provisions in the Penal Code about cybercrime"*
- *"Search for employment law under the Termination of Employment of Workmen Act"*
- *"Is the Computer Crimes Act No. 24 of 2007 still in force?"*
- *"What does the Companies Act No. 7 of 2007 say about director duties?"*
- *"Find provisions about intellectual property under the Intellectual Property Act"*
- *"Validate the citation 'Section 5 Personal Data Protection Act No. 9 of 2022'"*
- *"ව්‍යවස්ථාවෙහි සෞඛ්‍ය හිමිකම් ගැන කොතැනද?"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Statutes** | 2,055 laws | Comprehensive Sri Lankan legislation from commonlii.org/lk |
| **Provisions** | 32,790 sections | Full-text searchable with FTS5 |
| **Database Size** | ~48 MB | Optimized SQLite, portable |
| **Legal Definitions** | Table reserved | Extraction planned for upcoming release |
| **Freshness Checks** | Automated | Drift detection against official sources |

**Verified data only** -- every citation is validated against official sources (LawNet, Parliament of Sri Lanka). Zero LLM-generated content.

---

## Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from [commonlii.org/lk](https://www.commonlii.org/lk), [lawnet.gov.lk](https://lawnet.gov.lk), and [parliament.lk](https://parliament.lk)
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains statute text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by Act identifier + section number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
commonlii.org/lk / lawnet.gov.lk --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                                       ^                        ^
                                Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search lawnet.gov.lk by Act name | Search by plain English: *"personal data processing consent"* |
| Navigate multi-section statutes manually | Get the exact provision with context |
| Manual cross-referencing between Acts | `build_legal_stance` aggregates across sources |
| "Is this Act still in force?" -- check manually | `check_currency` tool -- answer in seconds |
| Find SAARC/Commonwealth alignment -- search manually | `get_eu_basis` -- linked frameworks instantly |
| No API, no integration | MCP protocol -- AI-native |

**Traditional:** Search LawNet -> Navigate HTML -> Ctrl+F -> Cross-reference between Acts -> Repeat

**This MCP:** *"What are the data controller obligations under the Personal Data Protection Act No. 9 of 2022?"* -> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 32,790 provisions with BM25 ranking. Supports English, Sinhala, and Tamil queries |
| `get_provision` | Retrieve specific provision by Act identifier + section number |
| `check_currency` | Check if a statute is in force, amended, or repealed |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple statutes for a legal topic |
| `format_citation` | Format citations per Sri Lankan legal conventions (Act No., year) |
| `list_sources` | List all available statutes with metadata, coverage scope, and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations that a Sri Lankan statute aligns with (e.g., PDPA 2022 and GDPR principles) |
| `get_srilanka_implementations` | Find Sri Lankan laws aligning with a specific international framework |
| `search_eu_implementations` | Search EU documents with Sri Lankan alignment counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Sri Lankan statutes against EU/SAARC frameworks |

---

## International Law Alignment

Sri Lanka is not an EU member state. The international alignment tools cover the frameworks that matter for Sri Lankan law practice:

- **SAARC frameworks** -- South Asian Association for Regional Cooperation conventions and model laws
- **Commonwealth** -- Commonwealth legal frameworks and model laws
- **Personal Data Protection Act No. 9 of 2022** aligns with international data protection principles, closely modelled on GDPR; the `get_eu_basis` tool maps provisions to their GDPR equivalents for cross-reference
- **Computer Crimes Act No. 24 of 2007** aligns with the Budapest Convention on Cybercrime (Commonwealth model)
- **Employment Acts** align with ILO conventions

The international bridge tools allow you to explore alignment relationships -- checking which Sri Lankan provisions correspond to SAARC or international requirements, and vice versa.

> **Note:** International cross-references reflect alignment and treaty obligations, not formal transposition. Sri Lanka adopts its own legislative approach, and these tools help identify where Sri Lankan and international law address similar domains.

---

## Data Sources & Freshness

All content is sourced from authoritative Sri Lankan legal databases:

- **[CommonLII Sri Lanka](https://www.commonlii.org/lk/)** -- Commonwealth Legal Information Institute Sri Lanka collection
- **[LawNet](https://lawnet.gov.lk/)** -- Official government law portal (Ministry of Justice)
- **[Parliament of Sri Lanka](https://parliament.lk/)** -- Official parliamentary records and Bills

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | LawNet (Ministry of Justice), Parliament of Sri Lanka |
| **Primary legal language** | English (Sinhala and Tamil are also official languages) |
| **License** | Public domain (government publications) |
| **Coverage** | 2,055 Sri Lankan Acts, Ordinances, and statutory instruments |
| **Last ingested** | 2026-02-28 |

### Automated Freshness Checks

A [GitHub Actions workflow](.github/workflows/check-updates.yml) monitors Sri Lankan legal sources for changes:

| Check | Method |
|-------|--------|
| **Statute amendments** | Drift detection against known provision anchors |
| **New statutes** | Comparison against LawNet and CommonLII indexes |
| **Repealed statutes** | Status change detection |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from LawNet, CommonLII, and Parliament of Sri Lanka official sources. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources before court filings
> - **International cross-references** reflect alignment relationships, not formal transposition
> - **Sinhala and Tamil versions** of statutes are official -- verify non-English text against primary sources
> - **Colonial-era Ordinances** may have complex application -- verify current status carefully

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment.

### Bar Association Reference

For professional use, consult the **Bar Association of Sri Lanka (BASL)** guidelines on AI-assisted legal research.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/Srilanka-law-mcp
cd Srilanka-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest              # Ingest statutes from commonlii.org/lk and lawnet.gov.lk
npm run build:db            # Rebuild SQLite database
npm run drift:detect        # Run drift detection against anchors
npm run check-updates       # Check for source updates
npm run census              # Generate coverage census
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~48 MB (efficient, portable)
- **Reliability:** 100% ingestion success rate across 2,055 laws

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

**80+ national law MCPs** covering Tanzania, Namibia, Uganda, Dominican Republic, Paraguay, India, Singapore, Australia, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (Supreme Court and Court of Appeal from CommonLII)
- Sinhala and Tamil provision text
- SAARC treaty cross-references
- Colonial-era Ordinance amendment tracking
- Historical statute versions

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Full corpus ingestion (2,055 laws, 32,790 provisions)
- [x] International law alignment tools
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Court case law expansion (Supreme Court, Court of Appeal)
- [ ] Sinhala and Tamil provision text
- [ ] SAARC convention cross-references
- [ ] Historical statute versions

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{srilanka_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Sri Lanka Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/Srilanka-law-mcp},
  note = {2,055 Sri Lankan laws with 32,790 provisions}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Government of Sri Lanka (public domain)
- **CommonLII data:** Commonwealth Legal Information Institute (open access)
- **International Metadata:** Public domain

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server makes Sri Lankan law accessible to legal professionals and compliance teams worldwide.

So we're open-sourcing it. Navigating 2,055 Acts and Ordinances shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
