// Publishable Firebase Web config — safe to ship to the browser.
// The VAPID public key is fetched separately from a server function
// (read from FIREBASE_VAPID_PUBLIC_KEY) so it stays in secrets.
export const firebaseConfig = {
  apiKey: "AIzaSyCzfdZ5cgVc1_TX5FylHdHcMZGASKqy7oA",
  authDomain: "mywaypins-d0968.firebaseapp.com",
  projectId: "mywaypins-d0968",
  storageBucket: "mywaypins-d0968.firebasestorage.app",
  messagingSenderId: "628775940516",
  appId: "1:628775940516:web:c40d48725f4b4a734e5131",
  measurementId: "G-LNWTI5",
} as const;
