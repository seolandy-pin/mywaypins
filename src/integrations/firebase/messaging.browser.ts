import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";
import { firebaseConfig } from "./config";

let appCache: FirebaseApp | null = null;
let messagingCache: Messaging | null = null;

function ensureApp(): FirebaseApp {
  if (appCache) return appCache;
  appCache = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return appCache;
}

export async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  try {
    if (!(await isSupported())) return null;
    if (messagingCache) return messagingCache;
    messagingCache = getMessaging(ensureApp());
    return messagingCache;
  } catch {
    return null;
  }
}

export async function requestFcmToken(vapidKey: string): Promise<string | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;
  if (Notification.permission === "denied") return null;
  if (Notification.permission !== "granted") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return null;
  }
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/",
  });
  try {
    return await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  } catch (e) {
    console.warn("[fcm] getToken failed", e);
    return null;
  }
}
