// =============================================
// FIREBASE CONFIG — HM Creative Admin Panel
// =============================================
const firebaseConfig = {
  apiKey: "AIzaSyBUp2PCc41DwqG3mB7gdVWKp21SmmYd4do",
  authDomain: "hm-creative.firebaseapp.com",
  databaseURL:
    "https://hm-creative-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hm-creative",
  storageBucket: "hm-creative.firebasestorage.app",
  messagingSenderId: "872956649005",
  appId: "1:872956649005:web:4b4c5c77cf88e1f88fa2a4",
};

// Initialize Firebase (compat mode)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();
const rtdb = firebase.database();
