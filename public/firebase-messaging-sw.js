/* global importScripts, firebase, self, clients */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCzfdZ5cgVc1_TX5FylHdHcMZGASKqy7oA",
  authDomain: "mywaypins-d0968.firebaseapp.com",
  projectId: "mywaypins-d0968",
  storageBucket: "mywaypins-d0968.firebasestorage.app",
  messagingSenderId: "628775940516",
  appId: "1:628775940516:web:c40d48725f4b4a734e5131",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(n.title || "MyWayPins", {
    body: n.body || "",
    data: { url: data.url || "/" },
    tag: data.tag || undefined,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
