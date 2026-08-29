// =============================================
// auth.js — HM Creative User Authentication & Account Guard
// Handles: login, registration, Google sign-in,
//          Firestore user profile sync, suspension enforcement
// =============================================

let isRegistering = false;

/* ── Toast Helper ── */
function showToast(msg, type = "error") {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 4500);
}

/* ── Button Loading Helper ── */
function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.original = btn.dataset.original || btn.innerHTML;
  btn.innerHTML = loading
    ? '<i class="fas fa-spinner fa-spin"></i> Please wait…'
    : btn.dataset.original;
}

/* ── Account Validation & Suspension Check ── */
async function validateUserAccount(user) {
  if (!user) return { valid: false, reason: "no_user" };
  
  // Master Administrator / Sub-admin UID is always valid
  if (user.uid === "gyugidvzamYHxJhBLVcrEvxjynI2" || user.uid === "VwxRpQIrfqg9oXoNcOdtmi9bflJ3") {
    return { valid: true, role: "admin", status: "active" };
  }

  if (typeof db !== "undefined" && db) {
    try {
      const snap = await db.collection("users").doc(user.uid).get();
      if (!snap.exists) {
        // Document deleted by admin or never created
        return { valid: false, reason: "account_not_found" };
      }
      const data = snap.data() || {};
      if (data.status === "suspended" || data.suspended === true) {
        return { valid: false, reason: "suspended", data };
      }
      return { valid: true, role: data.role || "user", status: data.status || "active", data };
    } catch (err) {
      console.warn("[Auth] Account validation notice:", err.message);
      return { valid: true, role: "user", status: "active" };
    }
  }
  return { valid: true, role: "user", status: "active" };
}

/* ── Save / Merge User Profile in Firestore AND Realtime Database ── */
async function saveUserProfile(user, extraData = {}) {
  if (!user) return;
  const userName = user.displayName || extraData.name || (user.email ? user.email.split("@")[0] : "User");

  const baseUserData = {
    uid: user.uid,
    name: userName,
    displayName: userName,
    email: user.email || "",
    photoURL: user.photoURL || "",
    phone: extraData.phone || "",
    role: extraData.role || "user",
    status: extraData.status || "active"
  };

  // 1. Save to Firestore (Single Source of Truth)
  if (typeof db !== "undefined" && db) {
    try {
      const ref = db.collection("users").doc(user.uid);
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({
          ...baseUserData,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        const existing = snap.data() || {};
        // Merge allowed profile fields without overriding admin-assigned role/status
        const updates = {
          name: baseUserData.name,
          displayName: baseUserData.displayName,
          email: baseUserData.email,
          photoURL: baseUserData.photoURL || existing.photoURL || ""
        };
        if (baseUserData.phone) updates.phone = baseUserData.phone;
        await ref.set(updates, { merge: true });
      }
    } catch (e) {
      console.warn("[Auth] Firestore profile sync warning:", e);
    }
  }

  // 2. Save to Realtime Database (RTDB)
  if (typeof rtdb !== "undefined" && rtdb) {
    try {
      const ref = rtdb.ref("users/" + user.uid);
      const snap = await ref.once("value");
      if (!snap.exists()) {
        await ref.set({
          ...baseUserData,
          createdAt: Date.now()
        });
      } else {
        const existing = snap.val() || {};
        const updates = {};
        if (!existing.email && baseUserData.email) updates.email = baseUserData.email;
        if (!existing.name && baseUserData.name) updates.name = baseUserData.name;
        if (!existing.displayName && baseUserData.displayName) updates.displayName = baseUserData.displayName;
        if (!existing.uid) updates.uid = user.uid;
        if (!existing.createdAt) updates.createdAt = Date.now();
        if (Object.keys(updates).length > 0) {
          await ref.update(updates);
        }
      }
    } catch (e) {
      console.warn("[Auth] RTDB profile sync warning:", e);
    }
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
      const cred = await auth.signInWithEmailAndPassword(email, password);

      // Check account status immediately
      const validation = await validateUserAccount(cred.user);
      if (!validation.valid) {
        await auth.signOut();
        if (validation.reason === "suspended") {
          showToast("⛔ Your account has been suspended by an administrator. Please contact support.", "error");
        } else if (validation.reason === "account_not_found") {
          showToast("❌ Account profile not found or access revoked. Please create a new account.", "error");
        }
        return;
      }

      // Respect pending redirect (e.g. from liking a project or booking an order)
      const redirect = sessionStorage.getItem("redirectAfterLogin");
      if (redirect) {
        sessionStorage.removeItem("redirectAfterLogin");
        window.location.href = redirect;
      } else {
        window.location.href = "index.html";
      }
    } catch (err) {
      showToast(friendlyError(err.code));
    } finally {
      setLoading(btn, false);
    }
  });
}

/* ── Google Sign-In ── */
const googleBtn = document.getElementById("googleBtn");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    setLoading(googleBtn, true);
    try {
      const cred = await auth.signInWithPopup(provider);
      const user = cred.user;

      if (typeof db !== "undefined" && db) {
        const snap = await db.collection("users").doc(user.uid).get();
        if (!snap.exists) {
          // Auto-create user document on first Google sign-in
          await saveUserProfile(user, {
            name: user.displayName || "Google User",
            role: "user",
            status: "active"
          });
        } else {
          const data = snap.data() || {};
          if (data.status === "suspended" || data.suspended === true) {
            await auth.signOut();
            showToast("⛔ Your account has been suspended by an administrator.", "error");
            return;
          }
        }
      }

      const redirect = sessionStorage.getItem("redirectAfterLogin");
      if (redirect) {
        sessionStorage.removeItem("redirectAfterLogin");
        window.location.href = redirect;
      } else {
        window.location.href = "index.html";
      }
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        showToast(friendlyError(err.code));
      }
    } finally {
      setLoading(googleBtn, false);
    }
  });
}

/* ── Registration Form ── */
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name     = document.getElementById("regName").value.trim();
    const email    = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirm  = document.getElementById("regConfirm").value;
    const btn      = document.getElementById("registerBtn");

    if (!name) {
      showToast("Please enter your full name.");
      return;
    }
    if (password !== confirm) {
      showToast("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      showToast("Password must be at least 6 characters.");
      return;
    }

    isRegistering = true;
    setLoading(btn, true);
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });
      
      // Automatically create Firestore document at users/{uid}
      await saveUserProfile(cred.user, {
        name: name,
        role: "user",
        status: "active"
      });

      // Respect pending redirect (e.g. came from liking a project)
      const redirect = sessionStorage.getItem("redirectAfterLogin");
      if (redirect) {
        sessionStorage.removeItem("redirectAfterLogin");
        window.location.href = redirect;
      } else {
        window.location.href = "index.html";
      }
    } catch (err) {
      showToast(friendlyError(err.code));
    } finally {
      isRegistering = false;
      setLoading(btn, false);
    }
  });
}

/* ── Redirect if already logged in (login/register pages) ── */
const isAuthPage =
  window.location.pathname.includes("login.html") ||
  window.location.pathname.includes("register.html");

if (isAuthPage) {
  auth.onAuthStateChanged(async (user) => {
    if (user && !isRegistering) {
      const validation = await validateUserAccount(user);
      if (!validation.valid) {
        await auth.signOut();
        return;
      }
      window.location.href = "index.html";
    }
  });
}

/* ── Friendly Error Messages ── */
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
