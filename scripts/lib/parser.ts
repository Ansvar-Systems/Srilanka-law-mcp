/**
 * Sri Lanka Law HTML Parser (CommonLII)
 *
 * Parses legislation pages from commonlii.org/lk/.
 *
 * Two-phase parsing:
 *   Phase 1: Parse the act's table of contents (index page) to extract
 *            section numbers, titles, and relative URLs.
 *   Phase 2: Parse individual section pages to extract the full text
 *            content of each provision.
 *
 * Section page HTML structure:
 *   <H3>Act Title - Sect N</H3>
 *   <p><b>Section title</b></p>
 *   <table><tr><td>N. Section content with nested tables for subsections</td></tr></table>
 *
 * Subsections use nested <table> elements:
 *   <table width=100%><tbody><tr><td><table width-100%><tr><td>(1) Content</td></tr></table></td></tr></tbody></table>
 *
 * Source: https://www.commonlii.org/lk/legis/
 */

export interface ActIndexEntry {
  id: string;
  title: string;
  titleEn: string;
  shortName: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
  description?: string;
}

export interface TocEntry {
  sectionNumber: string;
  title: string;
  href: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: string;
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

/**
 * Strip HTML tags and decode common entities, normalising whitespace.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#8220;/g, '\u201c')
    .replace(/&#8221;/g, '\u201d')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse the table of contents (index) page of an act.
 * Extracts section numbers, titles, and relative URLs.
 *
 * TOC format (inside <PRE> block):
 *   <A NAME="s1"></A>   <A HREF="s1.html">1</A>.	   Short title
 *   <A NAME="s2"></A>   <A HREF="s2.html">2</A>.	   Paddy lands cultivated ...
 */
export function parseToc(html: string): TocEntry[] {
  const entries: TocEntry[] = [];

  // Match patterns like: <A HREF="s1.html">1</A>.\t   Title text
  // Also handles longtitle.html and schedule pages
  const tocPattern = /<A\s+HREF="(s\d+[a-zA-Z]?\.html)">\s*(\d+[a-zA-Z]?)\s*<\/A>\.\s+([^\n<]+)/gi;

  let match: RegExpExecArray | null;
  while ((match = tocPattern.exec(html)) !== null) {
    const href = match[1].trim();
    const sectionNumber = match[2].trim();
    let title = match[3]
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();

    // Remove trailing whitespace entities
    title = title.replace(/\s*$/, '');

    if (sectionNumber && title) {
      entries.push({ sectionNumber, title, href });
    }
  }

  return entries;
}

/**
 * Parse an individual section page to extract the provision content.
 *
 * The section page structure is:
 *   <H3>Act Title - Sect N</H3>
 *   <p><b>Section title</b></p>
 *   <table><tr><td>N. Content with nested tables...</td></tr></table>
 *
 * Returns the section title and full text content.
 */
export function parseSectionPage(html: string): { title: string; content: string } {
  // Extract title from <p><b>...</b></p>
  const titleMatch = html.match(/<p><b>([^<]+)<\/b><\/p>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract content: everything between the first <HR> (after nav) and the last <BR><HR> (before footer)
  const hrParts = html.split(/<HR>/i);
  if (hrParts.length < 2) {
    return { title, content: '' };
  }

  // Content is between the first HR and the bottom nav
  let contentArea = hrParts.slice(1).join('<HR>');

  // Cut off footer nav (starts with <BR>\n<HR>)
  const footerIdx = contentArea.lastIndexOf('<BR>');
  if (footerIdx !== -1) {
    contentArea = contentArea.substring(0, footerIdx);
  }

  // Remove the H3 title line
  contentArea = contentArea.replace(/<H3>[^<]*<\/H3>/i, '');

  // Remove the <p><b>title</b></p> line
  contentArea = contentArea.replace(/<p><b>[^<]*<\/b><\/p>/i, '');

  // Strip HTML and clean up
  const content = stripHtml(contentArea);

  return { title, content };
}

/**
 * Extract date from the sino comment in section HTML.
 * Format: <!-- sino date 1 January 2000 -->
 */
export function extractDate(html: string): string {
  const dateMatch = html.match(/<!--\s*sino\s+date\s+(\d+\s+\w+\s+\d{4})\s*-->/i);
  if (dateMatch) {
    try {
      const d = new Date(dateMatch[1]);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch {
      // Ignore parse errors
    }
  }
  return '';
}

/**
 * Extract term definitions from provision text.
 *
 * Definitions in Sri Lankan legislation appear in interpretation sections
 * with patterns like:
 *   "term" means/includes definition text;
 *   "term" has the meaning assigned to it in ...
 */
export function extractDefinitions(provisions: ParsedProvision[]): ParsedDefinition[] {
  const definitions: ParsedDefinition[] = [];
  const seen = new Set<string>();

  for (const prov of provisions) {
    // Only look in interpretation/definition sections
    const lowerTitle = prov.title.toLowerCase();
    if (
      !lowerTitle.includes('interpretation') &&
      !lowerTitle.includes('definition') &&
      !lowerTitle.includes('meaning') &&
      !lowerTitle.includes('construction')
    ) {
      continue;
    }

    // Match patterns: "term" means/includes definition
    const defPattern = /["\u201c]([^"\u201d]{1,80})["\u201d]\s+(means|includes|has the (?:same )?meaning)\s+([^;]+)/gi;
    let defMatch: RegExpExecArray | null;

    while ((defMatch = defPattern.exec(prov.content)) !== null) {
      const term = defMatch[1].trim();
      const verb = defMatch[2].trim();
      const definition = `${verb} ${defMatch[3].trim()}`;

      if (term.length > 0 && definition.length > 5 && !seen.has(term.toLowerCase())) {
        seen.add(term.toLowerCase());
        definitions.push({
          term,
          definition,
          source_provision: prov.provision_ref,
        });
      }
    }
  }

  return definitions;
}

/**
 * Build a ParsedAct from the act metadata and fetched section pages.
 *
 * This is the main assembly function called by ingest.ts after it has:
 * 1. Parsed the TOC (via parseToc)
 * 2. Fetched each section page
 * 3. Parsed each section page (via parseSectionPage)
 */
export function assembleAct(
  act: ActIndexEntry,
  tocEntries: TocEntry[],
  sectionContents: Map<string, { title: string; content: string }>,
  firstSectionHtml?: string,
): ParsedAct {
  const provisions: ParsedProvision[] = [];
  let issuedDate = act.issuedDate;

  // Try to extract date from first section HTML
  if (firstSectionHtml && !issuedDate) {
    issuedDate = extractDate(firstSectionHtml);
  }

  for (const toc of tocEntries) {
    const section = sectionContents.get(toc.sectionNumber);
    if (!section) continue;

    const content = section.content;
    if (!content || content.length < 5) continue;

    provisions.push({
      provision_ref: `s${toc.sectionNumber}`,
      section: toc.sectionNumber,
      title: section.title || toc.title,
      content: content.substring(0, 12000), // Cap at 12KB per provision
    });
  }

  const definitions = extractDefinitions(provisions);

  return {
    id: act.id,
    type: 'statute',
    title: act.title,
    title_en: act.titleEn,
    short_name: act.shortName,
    status: act.status,
    issued_date: issuedDate,
    in_force_date: act.inForceDate,
    url: act.url,
    description: act.description,
    provisions,
    definitions,
  };
}
