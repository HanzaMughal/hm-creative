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
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.firestore();
const rtdb = firebase.database();



// Premium WhatsApp-style Web Audio synthesized notification sound
function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const now = audioCtx.currentTime;

    // Tone 1 (Pop 1: 880Hz, A5)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.005, now + 0.07);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.07);

    // Tone 2 (Pop 2: 1318.5Hz, E6)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1318.5, now + 0.065);
    gain2.gain.setValueAtTime(0.45, now + 0.065);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.065);
    osc2.stop(now + 0.35);

    // Subtle 2nd harmonic
    const oscH = audioCtx.createOscillator();
    const gainH = audioCtx.createGain();
    oscH.type = "sine";
    oscH.frequency.setValueAtTime(2637, now + 0.065);
    gainH.gain.setValueAtTime(0.12, now + 0.065);
    gainH.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    oscH.connect(gainH);
    gainH.connect(audioCtx.destination);
    oscH.start(now + 0.065);
    oscH.stop(now + 0.22);
  } catch (e) {
    try {
      const audio = new Audio("audio/whatsapp-notification.wav");
      audio.volume = 0.8;
      audio.play().catch(() => {});
    } catch (err) {}
  }
}

