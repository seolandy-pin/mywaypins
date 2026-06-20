import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns the VAPID public key for browser FCM token requests. */
export const getFcmVapidKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.FIREBASE_VAPID_PUBLIC_KEY ?? "" };
});

/** Upserts the current user's FCM token. */
export const registerFcmToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string; userAgent?: string }) => {
    if (!d?.token || typeof d.token !== "string" || d.token.length > 4096) {
      throw new Error("invalid token");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("fcm_tokens")
      .upsert(
        { user_id: context.userId, token: data.token, user_agent: data.userAgent ?? null },
        { onConflict: "token" },
      );
    if (error) throw error;
    return { ok: true };
  });
