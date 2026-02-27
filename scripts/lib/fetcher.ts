/**
 * Rate-limited HTTP client for Sri Lanka Law (CommonLII)
 *
 * - 500ms minimum delay between requests (be respectful to servers)
 * - User-Agent header identifying the MCP
 * - Fetches HTML from commonlii.org/lk/
 * - SSL verification disabled (CommonLII has certificate issues)
 * - No auth needed (Government Open Data)
 */

const USER_AGENT = 'srilanka-law-mcp/1.0 (https://github.com/Ansvar-Systems/srilanka-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 500;

// Disable SSL verification for CommonLII (certificate issues)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
  url: string;
}

/**
 * Fetch a URL with rate limiting and proper headers.
 * Retries up to 3 times on 429/5xx errors with exponential backoff.
 */
export async function fetchWithRateLimit(url: string, maxRetries = 3): Promise<FetchResult> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html, */*',
        },
        redirect: 'follow',
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt + 1) * 1000;
          console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }
      }

      const body = await response.text();
      return {
        status: response.status,
        body,
        contentType: response.headers.get('content-type') ?? '',
        url: response.url,
      };
    } catch (error) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`  Fetch error for ${url}: ${msg}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}
