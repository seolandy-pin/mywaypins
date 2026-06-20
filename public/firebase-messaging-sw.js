/* eslint-disable no-undef */
// Firebase Cloud Messaging service worker for background push notifications.
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

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
  const title = (payload.notification && payload.notification.title) || "MyWayPins";
  const body = (payload.notification && payload.notification.body) || "";
  const link = (payload.fcmOptions && payload.fcmOptions.link) || "/";
  self.registration.showNotification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { link },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(clients.openWindow(link));
});
