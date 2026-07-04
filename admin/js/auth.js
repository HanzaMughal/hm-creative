// =============================================
// auth.js — HM Creative Admin Panel
// Guards every admin page.
// =============================================

const ADMIN_REDIRECT = "login.html";
const LOGIN_PAGE     = window.location.pathname.endsWith("login.html");

/* ── Shared toast ── */
function showToast(msg, type = "error") {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className   = `toast show ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3800);
}

/* ── Loading overlay ── */
function setPageLoading(show) {
  let overlay = document.getElementById("pageLoadOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "pageLoadOverlay";
    overlay.innerHTML = `<div class="page-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
    document.body.appendChild(overlay);
  }
  overlay.style.display = show ? "flex" : "none";
}

/* ── Button loading state ── */
function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  if (!btn.dataset.orig) btn.dataset.orig = btn.innerHTML;
  btn.innerHTML = loading
    ? '<i class="fas fa-spinner fa-spin"></i> Please wait…'
    : btn.dataset.orig;
}

/* ── Check if UID is in /admins/{uid} ── */
async function isAdmin(uid) {
  if (uid === "gyugidvzamYHxJhBLVcrEvxjynI2") {
    return true;
  }
  try {
    const snap = await db.collection("admins").doc(uid).get();
    return snap.exists;
  } catch {
    return false;
  }
}

/* ── Auth guard (runs on every protected page) ── */
function adminAuthGuard(onAuthed) {
  setPageLoading(true);
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = ADMIN_REDIRECT;
      return;
    }
    const admin = await isAdmin(user.uid);
    if (!admin) {
      await auth.signOut();
      window.location.href = ADMIN_REDIRECT + "?error=access_denied";
      return;
    }
    setPageLoading(false);

    // Populate navbar user info
    const nameEl   = document.getElementById("navAdminName");
    const avatarEl = document.getElementById("navAdminAvatar");
    if (nameEl)   nameEl.textContent = user.displayName || user.email;
    if (avatarEl) avatarEl.src = user.photoURL ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "A")}&background=f5a623&color=000&bold=true`;

    onAuthed && onAuthed(user);
  });
}

/* ── Login form (login.html only) ── */
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  // If already logged in → redirect
  auth.onAuthStateChanged(async (user) => {
    if (user && await isAdmin(user.uid)) {
      window.location.href = "dashboard.html";
    }
  });

  // Check for access denied param
  const params = new URLSearchParams(window.location.search);
  if (params.get("error") === "access_denied") {
    setTimeout(() =>
      showToast("Access denied. This account is not an admin.", "error"), 300);
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email    = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;
    const btn      = document.getElementById("loginBtn");

    setLoading(btn, true);
    try {
      const cred  = await auth.signInWithEmailAndPassword(email, password);
      const admin = await isAdmin(cred.user.uid);
      if (!admin) {
        await auth.signOut();
        showToast("Access denied. You are not an admin.", "error");
        return;
      }
      window.location.href = "dashboard.html";
    } catch (err) {
      showToast(friendlyError(err.code), "error");
    } finally {
      setLoading(btn, false);
    }
  });
}

/* ── Logout ── */
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn?.addEventListener("click", async () => {
  if (confirm("Sign out of admin panel?")) {
    await auth.signOut();
    window.location.href = ADMIN_REDIRECT;
  }
});

/* ── Sidebar toggle (mobile) ── */
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar       = document.getElementById("sidebar");
sidebarToggle?.addEventListener("click", () => {
  sidebar?.classList.toggle("open");
});

/* ── Active nav link ── */
const currentPage = window.location.pathname.split("/").pop();
document.querySelectorAll(".nav-link").forEach((link) => {
  const href = link.getAttribute("href");
  if (href && href.includes(currentPage)) {
    link.classList.add("active");
  }
});

/* ── Friendly error messages ── */
function friendlyError(code) {
  const map = {
    "auth/user-not-found":         "No admin account found with this email.",
    "auth/wrong-password":         "Incorrect password.",
    "auth/invalid-email":          "Invalid email address.",
    "auth/too-many-requests":      "Too many attempts. Try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/invalid-credential":     "Invalid credentials. Please try again.",
  };
  return map[code] || "Authentication failed. Please try again.";
}

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
