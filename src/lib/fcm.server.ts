/**
 * FCM HTTP v1 sender. Uses Web Crypto (RSASSA-PKCS1-v1_5 + SHA-256) to mint
 * a Google OAuth2 access token from a service account JSON, so it runs in the
 * Cloudflare Worker SSR runtime without firebase-admin (Node-only).
 */

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function b64urlEncode(input: string | ArrayBuffer): string {
  let bin: string;
  if (typeof input === "string") bin = input;
  else {
    const bytes = new Uint8Array(input);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    bin = s;
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64urlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64urlEncode(sig)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`OAuth token failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: j.access_token,
    expiresAt: Date.now() + j.expires_in * 1000,
  };
  return j.access_token;
}

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch (e) {
    console.error("[fcm] invalid FIREBASE_SERVICE_ACCOUNT_JSON", e);
    return null;
  }
}

export type FcmSendResult = { token: string; ok: boolean; status?: number; error?: string };

/** Sends one notification to a list of device tokens. Invalid tokens are returned for cleanup. */
export async function sendFcmToTokens(
  tokens: string[],
  title: string,
  body: string,
  link?: string,
): Promise<FcmSendResult[]> {
  if (tokens.length === 0) return [];
  const sa = loadServiceAccount();
  if (!sa) {
    console.warn("[fcm] FIREBASE_SERVICE_ACCOUNT_JSON not set; skipping send");
    return [];
  }
  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (e) {
    console.error("[fcm] could not get access token", e);
    return [];
  }
  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const results = await Promise.all(
    tokens.map(async (token): Promise<FcmSendResult> => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              webpush: link
                ? { fcm_options: { link }, notification: { icon: "/favicon.ico" } }
                : { notification: { icon: "/favicon.ico" } },
            },
          }),
        });
        if (res.ok) return { token, ok: true };
        const errText = await res.text();
        return { token, ok: false, status: res.status, error: errText };
      } catch (e) {
        return { token, ok: false, error: String(e) };
      }
    }),
  );
  return results;
}
