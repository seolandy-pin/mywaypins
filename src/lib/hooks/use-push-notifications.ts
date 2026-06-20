import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getVapidKey, registerFcmToken } from "@/lib/api/fcm.functions";
import { requestFcmToken, onForegroundMessage } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/use-auth";
import { toast } from "sonner";

const STAMP_KEY = "mywaypins:fcm_registered_at";
const ONE_DAY = 24 * 3600 * 1000;

/**
 * Manages FCM permission + token registration for the signed-in user.
 * - If permission is already granted, silently refreshes the token once a day.
 * - Otherwise exposes `enable()` for a button to trigger the prompt.
 */
export function usePushNotifications() {
  const { isAuthenticated } = useAuth();
  const getKey = useServerFn(getVapidKey);
  const register = useServerFn(registerFcmToken);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );

  const doRegister = useCallback(async () => {
    try {
      const { vapidKey } = await getKey();
      if (!vapidKey) return null;
      const token = await requestFcmToken(vapidKey);
      if (!token) return null;
      await register({ data: { token, userAgent: navigator.userAgent } });
      localStorage.setItem(STAMP_KEY, String(Date.now()));
      return token;
    } catch (e) {
      console.warn("[fcm] register failed", e);
      return null;
    }
  }, [getKey, register]);

  // Auto-refresh token for users who've already granted permission.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const last = Number(localStorage.getItem(STAMP_KEY) ?? "0");
    if (Date.now() - last < ONE_DAY) return;
    doRegister();
  }, [isAuthenticated, doRegister]);

  // Foreground toast.
  useEffect(() => {
    if (!isAuthenticated) return;
    const off = onForegroundMessage((title, body) => {
      toast(title, { description: body });
    });
    return () => off();
  }, [isAuthenticated]);

  const enable = useCallback(async () => {
    const token = await doRegister();
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
    if (token) toast.success("푸시 알림이 켜졌습니다");
    else toast.error("알림을 켤 수 없었습니다");
    return token;
  }, [doRegister]);

  return { permission, enable };
}
