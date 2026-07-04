// =============================================
// auth.js — HM Creative User Panel
// Handles: login, register, Google sign-in,
//          auth state, user Firestore profile
// =============================================

/* ── helpers ── */
function showToast(msg, type = "error") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove("show"), 3500);
}

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.original = btn.dataset.original || btn.innerHTML;
  btn.innerHTML = loading
    ? '<i class="fas fa-spinner fa-spin"></i> Please wait…'
    : btn.dataset.original;
}

/* ── save / merge user profile in Firestore ── */
async function saveUserProfile(user, extraData = {}) {
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      name: user.displayName || extraData.name || "User",
      email: user.email,
      photoURL: user.photoURL || "",
      role: "user",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      ...extraData,
    });
  }
}

/* ── Email / Password Login ── */
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const btn = document.getElementById("loginBtn");

    setLoading(btn, true);
    try {
      await auth.signInWithEmailAndPassword(email, password);
      window.location.href = "index.html";
    } catch (err) {
      showToast(friendlyError(err.code));
    } finally {
      setLoading(btn, false);
    }
  });
}

/* ── Google Sign-In ── */
const googleBtns = document.querySelectorAll(".google-btn");
googleBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    setLoading(btn, true);
    try {
      const result = await auth.signInWithPopup(googleProvider);
      await saveUserProfile(result.user);
      window.location.href = "index.html";
    } catch (err) {
      showToast(friendlyError(err.code));
    } finally {
      setLoading(btn, false);
    }
  });
});

/* ── Registration ── */
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name     = document.getElementById("regName").value.trim();
    const email    = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirm  = document.getElementById("regConfirm").value;
    const btn      = document.getElementById("registerBtn");

    if (password !== confirm) {
      showToast("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      showToast("Password must be at least 6 characters.");
      return;
    }

    setLoading(btn, true);
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });
      await saveUserProfile(cred.user, { name });
      window.location.href = "index.html";
    } catch (err) {
      showToast(friendlyError(err.code));
    } finally {
      setLoading(btn, false);
    }
  });
}

/* ── Redirect if already logged in (login/register pages) ── */
const isAuthPage =
  window.location.pathname.includes("login.html") ||
  window.location.pathname.includes("register.html");

if (isAuthPage) {
  auth.onAuthStateChanged((user) => {
    if (user) window.location.href = "index.html";
  });
}

/* ── Friendly error messages ── */
function friendlyError(code) {
  const map = {
    "auth/user-not-found":       "No account found with this email.",
    "auth/wrong-password":       "Incorrect password. Try again.",
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/weak-password":        "Password is too weak. Use at least 6 characters.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/too-many-requests":    "Too many attempts. Please try again later.",
    "auth/invalid-credential":   "Invalid credentials. Please try again.",
  };
  return map[code] || "Something went wrong. Please try again.";
}
