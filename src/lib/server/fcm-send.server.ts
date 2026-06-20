// Server-only: sends FCM HTTP v1 push notifications using a Google service
// account JSON stored in FIREBASE_SERVICE_ACCOUNT_JSON. Uses Web Crypto so
// it runs on the Cloudflare Worker runtime.

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
};

let cachedToken: { token: string; exp: number } | null = null;
let cachedAccount: ServiceAccount | null = null;

function getAccount(): ServiceAccount {
  if (cachedAccount) return cachedAccount;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON missing");
  cachedAccount = JSON.parse(raw) as ServiceAccount;
  return cachedAccount;
}

function b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else if (input instanceof Uint8Array) bytes = input;
  else bytes = new Uint8Array(input);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;
  const sa = getAccount();
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: sa.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64url(sig)}`;
  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: j.access_token, exp: now + j.expires_in };
  return j.access_token;
}

export type FcmMessage = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Sends one push to many tokens. Invalid tokens are returned so the caller
 * can prune them from the database.
 */
export async function sendFcmToTokens(
  tokens: string[],
  msg: FcmMessage,
): Promise<{ sent: number; invalidTokens: string[] }> {
  if (tokens.length === 0) return { sent: 0, invalidTokens: [] };
  const sa = getAccount();
  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (e) {
    console.error("[fcm] access token error", e);
    return { sent: 0, invalidTokens: [] };
  }
  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const invalid: string[] = [];
  let sent = 0;
  await Promise.all(
    tokens.map(async (token) => {
      const payload = {
        message: {
          token,
          notification: { title: msg.title, body: msg.body },
          data: {
            url: msg.url ?? "/",
            ...(msg.tag ? { tag: msg.tag } : {}),
          },
          webpush: {
            fcm_options: { link: msg.url ?? "/" },
          },
        },
      };
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        sent++;
        return;
      }
      const status = r.status;
      const text = await r.text().catch(() => "");
      if (status === 404 || status === 400 || /UNREGISTERED|INVALID_ARGUMENT/i.test(text)) {
        invalid.push(token);
      } else {
        console.warn("[fcm] send failed", status, text.slice(0, 200));
      }
    }),
  );
  return { sent, invalidTokens: invalid };
}
