#!/usr/bin/env tsx
/**
 * Sri Lanka Law MCP -- Census Script (CommonLII Scraping)
 *
 * Scrapes the legislation index pages from commonlii.org/lk/ to enumerate
 * ALL acts. Writes data/census.json in golden standard format.
 *
 * Two databases are combined:
 *   - Numbered Acts (num_act): 2,054 acts (1956-2006), updated 2009
 *   - Consolidated Acts (consol_act): 516 acts (1980 Revised Edition), updated 2005
 *
 * We de-duplicate by title+number, preferring numbered acts when both exist
 * (numbered acts are newer and more granular).
 *
 * Source: https://www.commonlii.org/lk/
 *
 * Usage:
 *   npx tsx scripts/census.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');

/* ----- Jurisdiction constants ----- */
const JURISDICTION = 'LK';
const JURISDICTION_NAME = 'Sri Lanka';
const PORTAL = 'https://www.commonlii.org/lk';
const BASE_URL = 'https://www.commonlii.org';

/* ----- Database paths on CommonLII ----- */
const NUM_ACT_BASE = '/lk/legis/num_act';
const CONSOL_ACT_BASE = '/lk/legis/consol_act';

const ALPHA_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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
  source_db: 'num_act' | 'consol_act';
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

interface ScrapedAct {
  title: string;
  slug: string;
  sourceDb: 'num_act' | 'consol_act';
  year: number | null;
  actNumber: number | null;
}

/* ---------- Helpers ---------- */

/**
 * Extract year and act number from title.
 * E.g. "Agrarian Development Act (No. 46 of 2000)" -> { year: 2000, number: 46 }
 * E.g. "Adoption of Children (Chapter 76)" -> { year: null, number: 76 }
 */
function extractYearAndNumber(title: string): { year: number | null; actNumber: number | null } {
  // Numbered act pattern: (No. 46 of 2000)
  const numMatch = title.match(/\(No\.\s*(\d+)\s+of\s+(\d{4})\)/i);
  if (numMatch) {
    return { year: parseInt(numMatch[2], 10), actNumber: parseInt(numMatch[1], 10) };
  }

  // Consolidated act pattern: (Chapter 76)
  const chapMatch = title.match(/\(Chapter\s+(\d+)\)/i);
  if (chapMatch) {
    return { year: null, actNumber: parseInt(chapMatch[1], 10) };
  }

  return { year: null, actNumber: null };
}

/**
 * Generate a stable ID from slug and source database.
 */
function slugToId(slug: string, sourceDb: 'num_act' | 'consol_act'): string {
  const prefix = sourceDb === 'num_act' ? 'lk-act' : 'lk-consol';
  // Clean slug: remove trailing slashes, take last segment
  const cleanSlug = slug.replace(/\/$/, '').split('/').pop() ?? slug;
  return `${prefix}-${cleanSlug}`;
}

/**
 * Scrape act links from a CommonLII TOC page HTML.
 * Links are in <li><a href="SLUG">Title</a></li> format inside <ul> tags.
 */
function scrapeListingPage(html: string, baseDbPath: string): ScrapedAct[] {
  const acts: ScrapedAct[] = [];
  const sourceDb = baseDbPath.includes('num_act') ? 'num_act' as const : 'consol_act' as const;

  // Match <li><a href="SLUG">TITLE</a></li> inside the content area
  const linkPattern = /<li><a\s+href="([^"]+)"\s*>([^<]+)<\/a><\/li>/gi;

  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const slug = match[1].trim();
    let title = match[2]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    // Skip navigation links and empty titles
    if (!title || slug.startsWith('http') || slug.startsWith('/') || slug.startsWith('#')) continue;
    // Skip TOC index links like "toc-A.html"
    if (slug.startsWith('toc-')) continue;

    const { year, actNumber } = extractYearAndNumber(title);

    acts.push({
      title,
      slug,
      sourceDb,
      year,
      actNumber,
    });
  }

  return acts;
}

/**
 * Load existing census for merge/resume (preserves ingestion data).
 */
function loadExistingCensus(): Map<string, CensusLawEntry> {
  const existing = new Map<string, CensusLawEntry>();
  if (fs.existsSync(CENSUS_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf-8')) as CensusFile;
      for (const law of data.laws) {
        if ('ingested' in law) {
          existing.set(law.id, law);
        }
      }
    } catch {
      // Ignore parse errors, start fresh
    }
  }
  return existing;
}

/* ---------- Main ---------- */

async function main(): Promise<void> {
  console.log(`${JURISDICTION_NAME} Law MCP -- Census (CommonLII Scraping)`);
  console.log('='.repeat(60) + '\n');
  console.log(`  Jurisdiction:  ${JURISDICTION} (${JURISDICTION_NAME})`);
  console.log(`  Portal:        ${PORTAL}`);
  console.log(`  Databases:     num_act (numbered acts), consol_act (consolidated)`);
  console.log();

  const existingEntries = loadExistingCensus();
  if (existingEntries.size > 0) {
    console.log(`  Loaded ${existingEntries.size} existing entries from previous census\n`);
  }

  const allScrapedActs: ScrapedAct[] = [];
  const seenSlugs = new Set<string>();

  // --- Scrape numbered acts (alphabetical TOC pages) ---
  console.log('\n  === Numbered Acts (num_act) ===\n');

  for (const letter of ALPHA_LETTERS) {
    const url = `${BASE_URL}${NUM_ACT_BASE}/toc-${letter}.html`;
    process.stdout.write(`  [${letter}] Fetching...`);

    const result = await fetchWithRateLimit(url);

    if (result.status !== 200) {
      console.log(` HTTP ${result.status} (skipping)`);
      continue;
    }

    const pageActs = scrapeListingPage(result.body, NUM_ACT_BASE);
    const newActs = pageActs.filter(a => !seenSlugs.has(`num_act/${a.slug}`));

    for (const act of newActs) {
      seenSlugs.add(`num_act/${act.slug}`);
      allScrapedActs.push(act);
    }

    console.log(` ${newActs.length} acts (total: ${allScrapedActs.length})`);
  }

  // --- Scrape consolidated acts (alphabetical TOC pages) ---
  console.log('\n  === Consolidated Acts (consol_act) ===\n');

  const consolStartCount = allScrapedActs.length;

  for (const letter of ALPHA_LETTERS) {
    const url = `${BASE_URL}${CONSOL_ACT_BASE}/toc-${letter}.html`;
    process.stdout.write(`  [${letter}] Fetching...`);

    const result = await fetchWithRateLimit(url);

    if (result.status !== 200) {
      console.log(` HTTP ${result.status} (skipping)`);
      continue;
    }

    const pageActs = scrapeListingPage(result.body, CONSOL_ACT_BASE);
    const newActs = pageActs.filter(a => !seenSlugs.has(`consol_act/${a.slug}`));

    for (const act of newActs) {
      seenSlugs.add(`consol_act/${act.slug}`);
      allScrapedActs.push(act);
    }

    console.log(` ${newActs.length} acts (total consol: ${allScrapedActs.length - consolStartCount})`);
  }

  console.log(`\n  Total acts scraped: ${allScrapedActs.length}\n`);

  // Convert to census entries, merging with existing data
  const today = new Date().toISOString().split('T')[0];

  for (const scraped of allScrapedActs) {
    const id = slugToId(scraped.slug, scraped.sourceDb);

    // Preserve ingestion data from existing census if available
    const existing = existingEntries.get(id);

    const basePath = scraped.sourceDb === 'num_act' ? NUM_ACT_BASE : CONSOL_ACT_BASE;
    const url = `${BASE_URL}${basePath}/${scraped.slug}/`;

    const entry: CensusLawEntry = {
      id,
      title: scraped.title,
      identifier: scraped.sourceDb === 'num_act'
        ? `act/${scraped.year ?? 'unknown'}/${scraped.actNumber ?? 'unknown'}`
        : `chapter/${scraped.actNumber ?? 'unknown'}`,
      url,
      status: 'in_force',
      category: scraped.sourceDb === 'num_act' ? 'act' : 'consolidated',
      classification: 'ingestable',
      ingested: existing?.ingested ?? false,
      provision_count: existing?.provision_count ?? 0,
      ingestion_date: existing?.ingestion_date ?? null,
      source_db: scraped.sourceDb,
      year: scraped.year,
      act_number: scraped.actNumber,
    };

    existingEntries.set(id, entry);
  }

  // Build final census
  const allLaws = Array.from(existingEntries.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  const ingestable = allLaws.filter(l => l.classification === 'ingestable').length;
  const excluded = allLaws.filter(l => l.classification === 'excluded').length;
  const inaccessible = allLaws.filter(l => l.classification === 'inaccessible').length;

  const census: CensusFile = {
    schema_version: '1.0',
    jurisdiction: JURISDICTION,
    jurisdiction_name: JURISDICTION_NAME,
    portal: `${BASE_URL}/lk/`,
    census_date: today,
    agent: 'commonlii-scraper',
    summary: {
      total_laws: allLaws.length,
      ingestable,
      ocr_needed: 0,
      inaccessible,
      excluded,
    },
    laws: allLaws,
  };

  fs.mkdirSync(path.dirname(CENSUS_PATH), { recursive: true });
  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));

  console.log('='.repeat(60));
  console.log('Census Complete');
  console.log('='.repeat(60) + '\n');
  console.log(`  Total acts:     ${allLaws.length}`);
  console.log(`  Ingestable:     ${ingestable}`);
  console.log(`  Excluded:       ${excluded}`);
  console.log(`  Inaccessible:   ${inaccessible}`);
  console.log(`\n  Output: ${CENSUS_PATH}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
