import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns the public VAPID key needed by the browser to register for FCM. */
export const getVapidKey = createServerFn({ method: "GET" }).handler(async () => {
  return { vapidKey: process.env.FIREBASE_VAPID_PUBLIC_KEY ?? "" };
});

/** Stores (or refreshes) the current device's FCM token for the signed-in user. */
export const registerFcmToken = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; userAgent?: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    if (!data.token) return { ok: false as const };
    const { error } = await context.supabase
      .from("fcm_tokens")
      .upsert(
        { user_id: context.userId, token: data.token, user_agent: data.userAgent ?? null },
        { onConflict: "token" },
      );
    if (error) throw error;
    return { ok: true as const };
  });
