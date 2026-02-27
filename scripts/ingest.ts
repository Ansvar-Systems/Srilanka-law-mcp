#!/usr/bin/env tsx
/**
 * Sri Lanka Law MCP -- Census-Driven Ingestion Pipeline
 *
 * Reads data/census.json and fetches + parses every ingestable act
 * from commonlii.org/lk/ (simple HTML).
 *
 * Two-phase per act:
 *   1. Fetch the act's TOC page (index.html) to get section references
 *   2. Fetch each section page (s1.html, s2.html, ...) for full text
 *
 * Features:
 *   - Resume support: skips Acts that already have a seed JSON file
 *   - Census update: writes provision counts + ingestion dates back to census.json
 *   - Rate limiting: 500ms minimum between requests (via fetcher.ts)
 *
 * Usage:
 *   npm run ingest                    # Full census-driven ingestion
 *   npm run ingest -- --limit 5       # Test with 5 acts
 *   npm run ingest -- --skip-fetch    # Reuse cached HTML (re-parse only)
 *   npm run ingest -- --force         # Re-ingest even if seed exists
 *
 * Data source: commonlii.org/lk/ (Commonwealth Legal Information Institute)
 * Format: HTML
 * License: Government Open Data
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';
import {
  parseToc,
  parseSectionPage,
  assembleAct,
  type ActIndexEntry,
  type ParsedAct,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');

/* ---------- Types ---------- */

interface CensusLawEntry {
  id: string;
  title: string;
  identifier: string;
  url: string;
  status: 'in_force' | 'amended' | 'repealed';
  category: 'act' | 'consolidated';
  classification: 'ingestable' | 'excluded' | 'inaccessible';
  ingested: boolean;
  provision_count: number;
  ingestion_date: string | null;
  source_db: string;
  year: number | null;
  act_number: number | null;
}

interface CensusFile {
  schema_version: string;
  jurisdiction: string;
  jurisdiction_name: string;
  portal: string;
  census_date: string;
  agent: string;
  summary: {
    total_laws: number;
    ingestable: number;
    ocr_needed: number;
    inaccessible: number;
    excluded: number;
  };
  laws: CensusLawEntry[];
}

/* ---------- Helpers ---------- */

function parseArgs(): { limit: number | null; skipFetch: boolean; force: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    } else if (args[i] === '--force') {
      force = true;
    }
  }

  return { limit, skipFetch, force };
}

/**
 * Convert a census entry to an ActIndexEntry for the parser.
 */
function censusToActEntry(law: CensusLawEntry): ActIndexEntry {
  const shortName = law.title.length > 50 ? law.title.substring(0, 47) + '...' : law.title;

  return {
    id: law.id,
    title: law.title,
    titleEn: law.title,
    shortName,
    status: law.status === 'in_force' ? 'in_force' : law.status === 'amended' ? 'amended' : 'repealed',
    issuedDate: '',
    inForceDate: '',
    url: law.url,
  };
}

/* ---------- Main ---------- */

async function main(): Promise<void> {
  const { limit, skipFetch, force } = parseArgs();

  console.log('Sri Lanka Law MCP -- Ingestion Pipeline (Census-Driven)');
  console.log('=======================================================\n');
  console.log(`  Source: commonlii.org/lk/ (Commonwealth Legal Information Institute)`);
  console.log(`  Format: HTML (section-per-page)`);
  console.log(`  License: Government Open Data`);

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log(`  --skip-fetch`);
  if (force) console.log(`  --force (re-ingest all)`);

  // Load census
  if (!fs.existsSync(CENSUS_PATH)) {
    console.error(`\nERROR: Census file not found at ${CENSUS_PATH}`);
    console.error('Run "npx tsx scripts/census.ts" first.');
    process.exit(1);
  }

  const census: CensusFile = JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf-8'));
  const ingestable = census.laws.filter(l => l.classification === 'ingestable');
  const acts = limit ? ingestable.slice(0, limit) : ingestable;

  console.log(`\n  Census: ${census.summary.total_laws} total, ${ingestable.length} ingestable`);
  console.log(`  Processing: ${acts.length} acts\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let ingested = 0;
  let skipped = 0;
  let failed = 0;
  let totalProvisions = 0;
  let totalDefinitions = 0;
  let totalHttpRequests = 0;
  const results: { act: string; provisions: number; definitions: number; status: string }[] = [];

  // Build a map for census updates
  const censusMap = new Map<string, CensusLawEntry>();
  for (const law of census.laws) {
    censusMap.set(law.id, law);
  }

  const today = new Date().toISOString().split('T')[0];

  for (const law of acts) {
    const act = censusToActEntry(law);
    const sourceDir = path.join(SOURCE_DIR, act.id);
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);

    // Resume support: skip if seed already exists (unless --force)
    if (!force && fs.existsSync(seedFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedAct;
        const provCount = existing.provisions?.length ?? 0;
        const defCount = existing.definitions?.length ?? 0;
        totalProvisions += provCount;
        totalDefinitions += defCount;

        // Update census entry
        const entry = censusMap.get(law.id);
        if (entry) {
          entry.ingested = true;
          entry.provision_count = provCount;
          entry.ingestion_date = entry.ingestion_date ?? today;
        }

        results.push({ act: act.shortName, provisions: provCount, definitions: defCount, status: 'resumed' });
        skipped++;
        processed++;
        continue;
      } catch {
        // Corrupt seed file, re-ingest
      }
    }

    try {
      // Phase 1: Fetch and parse the act's TOC page
      const tocFile = path.join(sourceDir, 'index.html');
      let tocHtml: string;

      fs.mkdirSync(sourceDir, { recursive: true });

      if (fs.existsSync(tocFile) && skipFetch) {
        tocHtml = fs.readFileSync(tocFile, 'utf-8');
        process.stdout.write(`  [${processed + 1}/${acts.length}] Using cached TOC ${act.id}`);
      } else {
        process.stdout.write(`  [${processed + 1}/${acts.length}] Fetching TOC ${act.id}...`);
        const tocResult = await fetchWithRateLimit(act.url);
        totalHttpRequests++;

        if (tocResult.status !== 200) {
          console.log(` HTTP ${tocResult.status}`);
          const entry = censusMap.get(law.id);
          if (entry) entry.classification = 'inaccessible';
          results.push({ act: act.shortName, provisions: 0, definitions: 0, status: `HTTP ${tocResult.status}` });
          failed++;
          processed++;
          continue;
        }

        tocHtml = tocResult.body;
        fs.writeFileSync(tocFile, tocHtml);
      }

      const tocEntries = parseToc(tocHtml);

      if (tocEntries.length === 0) {
        console.log(` 0 sections in TOC (skipping)`);
        results.push({ act: act.shortName, provisions: 0, definitions: 0, status: 'empty_toc' });
        const entry = censusMap.get(law.id);
        if (entry) {
          entry.ingested = true;
          entry.provision_count = 0;
          entry.ingestion_date = today;
        }
        processed++;
        continue;
      }

      console.log(` ${tocEntries.length} sections`);

      // Phase 2: Fetch each section page
      const sectionContents = new Map<string, { title: string; content: string }>();
      let firstSectionHtml: string | undefined;
      let sectionsFetched = 0;

      for (const toc of tocEntries) {
        const sectionFile = path.join(sourceDir, toc.href);
        let sectionHtml: string;

        if (fs.existsSync(sectionFile) && skipFetch) {
          sectionHtml = fs.readFileSync(sectionFile, 'utf-8');
        } else {
          // Build section URL from act URL + section href
          const sectionUrl = act.url.replace(/\/$/, '') + '/' + toc.href;
          const sectionResult = await fetchWithRateLimit(sectionUrl);
          totalHttpRequests++;
          sectionsFetched++;

          if (sectionResult.status !== 200) {
            continue; // Skip failed sections
          }

          sectionHtml = sectionResult.body;
          fs.writeFileSync(sectionFile, sectionHtml);
        }

        if (!firstSectionHtml) firstSectionHtml = sectionHtml;

        const parsed = parseSectionPage(sectionHtml);
        sectionContents.set(toc.sectionNumber, parsed);
      }

      if (sectionsFetched > 0) {
        process.stdout.write(`    -> Fetched ${sectionsFetched} section pages`);
      }

      // Phase 3: Assemble the act
      const parsed = assembleAct(act, tocEntries, sectionContents, firstSectionHtml);
      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));

      totalProvisions += parsed.provisions.length;
      totalDefinitions += parsed.definitions.length;
      console.log(`    -> ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions`);

      // Update census entry
      const entry = censusMap.get(law.id);
      if (entry) {
        entry.ingested = true;
        entry.provision_count = parsed.provisions.length;
        entry.ingestion_date = today;
      }

      results.push({
        act: act.shortName,
        provisions: parsed.provisions.length,
        definitions: parsed.definitions.length,
        status: 'OK',
      });
      ingested++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR parsing ${act.id}: ${msg}`);
      results.push({ act: act.shortName, provisions: 0, definitions: 0, status: `ERROR: ${msg.substring(0, 80)}` });
      failed++;
    }

    processed++;

    // Save census every 25 acts (checkpoint)
    if (processed % 25 === 0) {
      writeCensus(census, censusMap);
      console.log(`  [checkpoint] Census updated at ${processed}/${acts.length}`);
    }
  }

  // Final census update
  writeCensus(census, censusMap);

  // Report
  console.log(`\n${'='.repeat(70)}`);
  console.log('Ingestion Report');
  console.log('='.repeat(70));
  console.log(`\n  Source:      commonlii.org/lk/ (HTML)`);
  console.log(`  Processed:   ${processed}`);
  console.log(`  New:         ${ingested}`);
  console.log(`  Resumed:     ${skipped}`);
  console.log(`  Failed:      ${failed}`);
  console.log(`  HTTP reqs:   ${totalHttpRequests}`);
  console.log(`  Total provisions:  ${totalProvisions}`);
  console.log(`  Total definitions: ${totalDefinitions}`);

  // Summary of failures
  const failures = results.filter(r => r.status.startsWith('HTTP') || r.status.startsWith('ERROR'));
  if (failures.length > 0) {
    console.log(`\n  Failed acts:`);
    for (const f of failures) {
      console.log(`    ${f.act}: ${f.status}`);
    }
  }

  // Zero-provision acts
  const zeroProv = results.filter(r => r.provisions === 0 && r.status === 'OK');
  if (zeroProv.length > 0) {
    console.log(`\n  Zero-provision acts (${zeroProv.length}):`);
    for (const z of zeroProv.slice(0, 20)) {
      console.log(`    ${z.act}`);
    }
    if (zeroProv.length > 20) {
      console.log(`    ... and ${zeroProv.length - 20} more`);
    }
  }

  console.log('');
}

function writeCensus(census: CensusFile, censusMap: Map<string, CensusLawEntry>): void {
  // Update the laws array from the map
  census.laws = Array.from(censusMap.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  // Recalculate summary
  census.summary.total_laws = census.laws.length;
  census.summary.ingestable = census.laws.filter(l => l.classification === 'ingestable').length;
  census.summary.inaccessible = census.laws.filter(l => l.classification === 'inaccessible').length;
  census.summary.excluded = census.laws.filter(l => l.classification === 'excluded').length;

  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
