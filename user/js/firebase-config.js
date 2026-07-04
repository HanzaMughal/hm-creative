// =============================================
// FIREBASE CONFIG — HM Creative
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

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Premium Web Audio synthesized notification sound
function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.1); // A5
    
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (e) {
    console.warn("Audio notification failed:", e);
  }
}
