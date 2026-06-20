import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getFcmVapidKey, registerFcmToken } from "@/lib/api/fcm.functions";
import { requestFcmToken } from "@/integrations/firebase/messaging.client";
import { useAuth } from "@/lib/auth/use-auth";

const STAMP_KEY = "mywaypins:fcm_registered_at";
const MIN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Requests a Firebase Cloud Messaging token for the signed-in user and
 * stores it in fcm_tokens so the daily refresh job can push notifications.
 * Skips silently if notifications are denied or unsupported.
 */
export function useFcmRegister() {
  const { isAuthenticated } = useAuth();
  const fetchKey = useServerFn(getFcmVapidKey);
  const register = useServerFn(registerFcmToken);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "denied") return;
    const last = Number(localStorage.getItem(STAMP_KEY) ?? "0");
    if (Date.now() - last < MIN_INTERVAL_MS) return;

    (async () => {
      try {
        const { key } = await fetchKey();
        if (!key) return;
        const token = await requestFcmToken(key);
        if (!token) return;
        await register({ data: { token, userAgent: navigator.userAgent } });
        localStorage.setItem(STAMP_KEY, String(Date.now()));
      } catch (e) {
        console.warn("[fcm] register failed", e);
      }
    })();
  }, [isAuthenticated, fetchKey, register]);
}
