// =============================================
// auth.js — HM Creative User Authentication & Account Guard
// Handles: login, registration, Google sign-in,
//          Firestore user profile sync, suspension enforcement
// =============================================

let isRegistering = false;
let isPromptingPhone = false;

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
        if (baseUserData.phone) updates.phone = baseUserData.phone;
        if (Object.keys(updates).length > 0) {
          await ref.update(updates);
        }
      }
    } catch (e) {
      console.warn("[Auth] RTDB profile sync warning:", e);
    }
  }
}

/* ── Country Code & Phone Formatter ── */
function formatFullPhoneNumber(countryCode = "+92", inputPhone = "") {
  let raw = (inputPhone || "").trim();
  // Remove any non-digit except '+'
  let cleaned = raw.replace(/[^\d+]/g, "");

  // If user already typed with '+' at the start, return as is
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // If user typed '00' followed by country code digits
  const codeDigits = (countryCode || "").replace(/\D/g, "");
  if (codeDigits && cleaned.startsWith("00" + codeDigits)) {
    cleaned = cleaned.slice(2 + codeDigits.length);
  } else if (codeDigits && cleaned.startsWith(codeDigits) && cleaned.length > codeDigits.length + 6) {
    cleaned = cleaned.slice(codeDigits.length);
  }

  // Remove leading zeros (domestic trunk prefix, e.g. 0300 -> 300)
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.replace(/^0+/, "");
  }

  return (countryCode || "+92") + " " + cleaned;
}

/* ── Missing WhatsApp / Phone Prompt Modal ── */
function promptMissingPhone(user, redirectUrl = "index.html") {
  isPromptingPhone = true;
  let modal = document.getElementById("authPhonePromptModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "authPhonePromptModal";
    modal.className = "auth-modal-overlay";
    modal.innerHTML = `
      <div class="auth-modal-card">
        <div class="auth-modal-icon-wrap">
          <i class="fab fa-whatsapp"></i>
        </div>
        <h3 class="auth-modal-title">One Last Step! 👋</h3>
        <p class="auth-modal-subtitle">
          Please provide your WhatsApp or phone number so Hamza Mughal and the HM Creative team can reach you regarding your projects and orders.
        </p>
        <form id="phonePromptForm" novalidate>
          <div class="form-group">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">
              <label for="promptPhoneInput" style="margin:0;">WhatsApp / Phone Number</label>
              <span style="font-size:0.72rem;color:#25D366;font-weight:600;"><i class="fab fa-whatsapp"></i> WhatsApp Preferred</span>
            </div>
            <div class="phone-input-row">
              <div class="country-code-wrap">
                <select id="promptCountryCode" class="country-code-select" aria-label="Country Code">
                  <option value="+92" selected>🇵🇰 +92 (Pakistan)</option>
                  <option value="+91">🇮🇳 +91 (India)</option>
                  <option value="+93">🇦🇫 +93 (Afghanistan)</option>
                  <option value="+98">🇮🇷 +98 (Iran)</option>
                  <option value="+971">🇦🇪 +971 (UAE)</option>
                  <option value="+966">🇸🇦 +966 (Saudi Arabia)</option>
                  <option value="+974">🇶🇦 +974 (Qatar)</option>
                  <option value="+965">🇰🇼 +965 (Kuwait)</option>
                  <option value="+968">🇴🇲 +968 (Oman)</option>
                  <option value="+90">🇹🇷 +90 (Turkey)</option>
                  <option value="+86">🇨🇳 +86 (China)</option>
                  <option value="+81">🇯🇵 +81 (Japan)</option>
                  <option value="+44">🇬🇧 +44 (UK)</option>
                  <option value="+1">🇺🇸 +1 (USA)</option>
                  <option value="+1">🇨🇦 +1 (Canada)</option>
                  <option value="+49">🇩🇪 +49 (Germany)</option>
                  <option value="+33">🇫🇷 +33 (France)</option>
                  <option value="+39">🇮🇹 +39 (Italy)</option>
                  <option value="+34">🇪🇸 +34 (Spain)</option>
                  <option value="+61">🇦🇺 +61 (Australia)</option>
                  <option value="+52">🇲🇽 +52 (Mexico)</option>
                  <option value="+55">🇧🇷 +55 (Brazil)</option>
                  <option value="+504">🇭🇳 +504 (Honduras)</option>
                </select>
              </div>
              <div class="input-wrap phone-number-wrap">
                <i class="fab fa-whatsapp" style="color:#25D366;"></i>
                <input
                  type="tel"
                  id="promptPhoneInput"
                  placeholder="e.g. 300 1234567"
                  autocomplete="tel-national"
                  required
                />
              </div>
            </div>
            <p style="font-size:0.73rem;color:var(--text-dim);margin-top:0.35rem;text-align:left;">
              Select your country code and enter your WhatsApp number (preferred) or mobile number.
            </p>
          </div>
          <button type="submit" class="btn btn-gold full-btn" id="savePhonePromptBtn">
            <i class="fas fa-check-circle"></i> Save &amp; Continue
          </button>
          <button type="button" class="skip-btn" id="skipPhonePromptBtn">
            Skip for now &rarr;
          </button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const form = modal.querySelector("#phonePromptForm");
    const input = modal.querySelector("#promptPhoneInput");
    const saveBtn = modal.querySelector("#savePhonePromptBtn");
    const skipBtn = modal.querySelector("#skipPhonePromptBtn");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const countryEl = modal.querySelector("#promptCountryCode");
      const cCode = countryEl ? countryEl.value : "+92";
      const phoneVal = (input.value || "").trim();
      if (!phoneVal) {
        showToast("Please enter your WhatsApp or phone number.", "error");
        input.focus();
        return;
      }
      const digits = phoneVal.replace(/[^0-9]/g, "");
      if (digits.length < 5 || digits.length > 15) {
        showToast("Please enter a valid phone number (at least 5-7 digits).", "error");
        input.focus();
        return;
      }

      const fullFormattedPhone = formatFullPhoneNumber(cCode, phoneVal);

      setLoading(saveBtn, true);
      try {
        await saveUserProfile(user, { phone: fullFormattedPhone });
        showToast("Phone number saved successfully! 🎉", "success");
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 600);
      } catch (err) {
        console.warn("[Auth] Error saving phone:", err);
        showToast("Failed to save phone number. Please try again.", "error");
        setLoading(saveBtn, false);
      }
    });

    skipBtn.addEventListener("click", () => {
      window.location.href = redirectUrl;
    });
  }

  // Show modal
  requestAnimationFrame(() => {
    modal.classList.add("active");
    const input = document.getElementById("promptPhoneInput");
    if (input) input.focus();
  });
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
      const redirect = sessionStorage.getItem("redirectAfterLogin") || "index.html";
      sessionStorage.removeItem("redirectAfterLogin");

      // Check if user is missing phone number
      const userDoc = validation.data || {};
      if (!userDoc.phone && !userDoc.phoneNumber) {
        promptMissingPhone(cred.user, redirect);
        return;
      }

      window.location.href = redirect;
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
      let userPhone = "";

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
          userPhone = data.phone || data.phoneNumber || "";
        }
      }

      const redirect = sessionStorage.getItem("redirectAfterLogin") || "index.html";
      sessionStorage.removeItem("redirectAfterLogin");

      if (!userPhone) {
        promptMissingPhone(user, redirect);
        return;
      }

      window.location.href = redirect;
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
    const name         = document.getElementById("regName").value.trim();
    const email        = document.getElementById("regEmail").value.trim();
    const countryEl    = document.getElementById("regCountryCode");
    const countryCode  = countryEl ? countryEl.value : "+92";
    const phoneInput   = document.getElementById("regPhone");
    const phoneRaw     = phoneInput ? phoneInput.value.trim() : "";
    const password     = document.getElementById("regPassword").value;
    const confirm      = document.getElementById("regConfirm").value;
    const btn          = document.getElementById("registerBtn");

    if (!name) {
      showToast("Please enter your full name.");
      return;
    }
    if (!email) {
      showToast("Please enter your email address.");
      return;
    }
    if (!phoneRaw) {
      showToast("Please enter your WhatsApp or phone number.");
      if (phoneInput) phoneInput.focus();
      return;
    }
    const phoneDigits = phoneRaw.replace(/[^0-9]/g, "");
    if (phoneDigits.length < 5 || phoneDigits.length > 15) {
      showToast("Please enter a valid phone number.");
      if (phoneInput) phoneInput.focus();
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

    const fullPhone = formatFullPhoneNumber(countryCode, phoneRaw);

    isRegistering = true;
    setLoading(btn, true);
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });
      
      // Automatically create Firestore document at users/{uid} with WhatsApp / phone
      await saveUserProfile(cred.user, {
        name: name,
        phone: fullPhone,
        role: "user",
        status: "active"
      });

      // Respect pending redirect (e.g. came from liking a project)
      const redirect = sessionStorage.getItem("redirectAfterLogin") || "index.html";
      sessionStorage.removeItem("redirectAfterLogin");
      window.location.href = redirect;
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
    if (user && !isRegistering && !isPromptingPhone) {
      const validation = await validateUserAccount(user);
      if (!validation.valid) {
        await auth.signOut();
        return;
      }
      const uData = validation.data || {};
      if (!uData.phone && !uData.phoneNumber) {
        const redirect = sessionStorage.getItem("redirectAfterLogin") || "index.html";
        promptMissingPhone(user, redirect);
        return;
      }
      const redirect = sessionStorage.getItem("redirectAfterLogin") || "index.html";
      sessionStorage.removeItem("redirectAfterLogin");
      window.location.href = redirect;
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
