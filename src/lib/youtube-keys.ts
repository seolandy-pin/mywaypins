/**
 * YouTube API key rotation helper.
 *
 * Supports up to 5 keys via env: YOUTUBE_API_KEY, YOUTUBE_API_KEY_2..5.
 * On 403 (quota) or 429 (rate-limit) responses, automatically retries the
 * same URL with the next key. Caller passes a URL builder so we can swap
 * the `key=` query parameter per attempt.
 *
 * Server-only — only reference inside createServerFn handlers / server routes.
 */

export function getYouTubeKeys(): string[] {
  const raw = [
    process.env.YOUTUBE_API_KEY,
    process.env.YOUTUBE_API_KEY_2,
    process.env.YOUTUBE_API_KEY_3,
    process.env.YOUTUBE_API_KEY_4,
    process.env.YOUTUBE_API_KEY_5,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of raw) {
    const v = (k ?? "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function hasYouTubeKey(): boolean {
  return getYouTubeKeys().length > 0;
}

/**
 * Fetch a YouTube API URL, rotating keys on 403/429.
 * `buildUrl(key)` must include `&key=${key}` (or `?key=${key}`).
 * Returns the first OK response, or the last error response if all keys fail.
 */
export async function ytFetch(buildUrl: (key: string) => string): Promise<Response> {
  const keys = getYouTubeKeys();
  if (keys.length === 0) throw new Error("YOUTUBE_API_KEY not configured");
  let lastRes: Response | null = null;
  for (let i = 0; i < keys.length; i++) {
    const res = await fetch(buildUrl(keys[i]));
    if (res.ok) return res;
    if (res.status === 403 || res.status === 429) {
      console.warn(
        `[youtube] key #${i + 1}/${keys.length} returned ${res.status}; ${
          i + 1 < keys.length ? "rotating to next key" : "no more keys to try"
        }`,
      );
      lastRes = res;
      continue;
    }
    // Non-quota error — return immediately, no point rotating.
    return res;
  }
  return lastRes!;
}
