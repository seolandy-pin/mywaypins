import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCzfdZ5cgVc1_TX5FylHdHcMZGASKqy7oA",
  authDomain: "mywaypins-d0968.firebaseapp.com",
  projectId: "mywaypins-d0968",
  storageBucket: "mywaypins-d0968.firebasestorage.app",
  messagingSenderId: "628775940516",
  appId: "1:628775940516:web:c40d48725f4b4a734e5131",
};

function app(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  return getApps()[0] ?? initializeApp(firebaseConfig);
}

/**
 * Requests notification permission and registers an FCM token.
 * Returns the token on success, or null if unsupported / denied.
 */
export async function requestFcmToken(vapidKey: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;
  if (!(await isSupported())) return null;
  const a = app();
  if (!a) return null;

  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") return null;

  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const messaging = getMessaging(a);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: reg,
  });
  return token ?? null;
}

/** Listen for foreground messages (page is focused). */
export function onForegroundMessage(cb: (title: string, body: string) => void) {
  if (typeof window === "undefined") return () => {};
  const a = app();
  if (!a) return () => {};
  let unsub = () => {};
  isSupported().then((ok) => {
    if (!ok) return;
    const messaging = getMessaging(a);
    unsub = onMessage(messaging, (payload) => {
      cb(payload.notification?.title ?? "MyWayPins", payload.notification?.body ?? "");
    });
  });
  return () => unsub();
}
