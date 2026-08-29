/* ================================================================
   navbar.js — HM Creative
   Shared: navbar scroll-darken + mobile drawer toggle + overlay
   Include AFTER the DOM (before </body>) on every user-facing page
   ================================================================ */

(function () {
  "use strict";

  /* ── Navbar scroll: darken + blur on scroll ── */
  const navbar = document.getElementById("navbar");
  if (navbar) {
    // Apply immediately on load (in case page is loaded mid-scroll)
    navbar.classList.toggle("scrolled", window.scrollY > 50);

    let _ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (!_ticking) {
          window.requestAnimationFrame(() => {
            navbar.classList.toggle("scrolled", window.scrollY > 50);
            _ticking = false;
          });
          _ticking = true;
        }
      },
      { passive: true }
    );
  }

  /* ── Mobile drawer toggle ── */
  const navToggle = document.getElementById("navToggle");
  const navLinks  = document.getElementById("navLinks");
  const overlay   = document.getElementById("navOverlay");

  function openDrawer() {
    navToggle?.classList.add("open");
    navLinks?.classList.add("open");
    overlay?.classList.add("open");
    document.body.style.overflow = "hidden"; // prevent body scroll while drawer open
  }

  function closeDrawer() {
    navToggle?.classList.remove("open");
    navLinks?.classList.remove("open");
    overlay?.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (navToggle) {
    navToggle.addEventListener("click", () => {
      const isOpen = navLinks?.classList.contains("open");
      isOpen ? closeDrawer() : openDrawer();
    });
  }

  // Close drawer when any nav link is clicked
  if (navLinks) {
    navLinks.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", closeDrawer);
    });
  }

  // Close drawer when overlay is tapped
  if (overlay) {
    overlay.addEventListener("click", closeDrawer);
  }

  // Close drawer on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  /* ================================================================
     Shared Navbar Auth & Profile Popup Card
     ================================================================ */
  function initNavbarAuth() {
    const navAuthArea = document.getElementById("navAuthArea");
    if (!navAuthArea || typeof firebase === "undefined" || !firebase.auth) return;

    function escapeHtml(str) {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        navAuthArea.innerHTML = `
          <a href="login.html" class="btn btn-ghost" style="padding:0.45rem 1.1rem;font-size:0.82rem;">
            <i class="fas fa-sign-in-alt"></i> Login
          </a>`;
        return;
      }

      // Master admin is exempt from doc check
      const isMasterAdmin = (user.uid === "gyugidvzamYHxJhBLVcrEvxjynI2");

      // Fetch user profile from Firestore (Single Source of Truth)
      let displayName = user.displayName || "";
      let userRole = "Client";
      let joinedDateStr = "";
      let isSuspended = false;
      let profileDocFound = false;

      const dbInstance = window.db || (typeof firebase.firestore === "function" ? firebase.firestore() : null);
      if (dbInstance) {
        try {
          const userSnap = await dbInstance.collection("users").doc(user.uid).get();
          if (userSnap.exists) {
            profileDocFound = true;
            const data = userSnap.data();
            if (data.status === "suspended" || data.suspended === true) {
              isSuspended = true;
            }
            if (data.name || data.displayName) displayName = data.name || data.displayName;
            if (data.role === "admin") {
              userRole = "Administrator";
            } else if (data.role) {
              userRole = data.role.charAt(0).toUpperCase() + data.role.slice(1);
            }
            if (data.createdAt && data.createdAt.toDate) {
              const d = data.createdAt.toDate();
              joinedDateStr = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
            }
          }
        } catch (e) {
          console.warn("[Navbar] Firestore profile fetch error:", e);
        }

        // Real-time listener for live suspension enforcement
        try {
          dbInstance.collection("users").doc(user.uid).onSnapshot((snap) => {
            if (snap.exists) {
              const d = snap.data() || {};
              if (d.status === "suspended" || d.suspended === true) {
                firebase.auth().signOut().then(() => {
                  window.location.href = "login.html?error=suspended";
                });
              }
            }
          });
        } catch (e) {}
      }

      // Check suspension state: kick out immediately
      if (isSuspended) {
        await firebase.auth().signOut();
        window.location.href = "login.html?error=suspended";
        return;
      }

      // If document does not exist in Firestore (and not master admin), treat as revoked
      if (!profileDocFound && !isMasterAdmin && dbInstance) {
        await firebase.auth().signOut();
        window.location.href = "login.html?error=account_not_found";
        return;
      }

      if (!profileDocFound) {
        const rtdbInstance = window.rtdb || (typeof firebase.database === "function" ? firebase.database() : null);
        if (rtdbInstance) {
          try {
            const userSnap = await rtdbInstance.ref("users/" + user.uid).once("value");
            if (userSnap.exists()) {
              const data = userSnap.val() || {};
              if (data.name || data.displayName) displayName = data.name || data.displayName;
              if (data.role) userRole = data.role.charAt(0).toUpperCase() + data.role.slice(1);
              if (data.createdAt) {
                const d = new Date(data.createdAt);
                if (!isNaN(d)) joinedDateStr = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
              }
            }
          } catch (e) {}
        }
      }

      if (user.metadata && user.metadata.creationTime && !joinedDateStr) {
        try {
          const d = new Date(user.metadata.creationTime);
          joinedDateStr = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        } catch (e) {}
      }

      const email = user.email || "No email";
      const shortName = displayName ? displayName.split(" ")[0] : (email.includes("@") ? email.split("@")[0] : "User");
      const nameForAvatar = displayName || shortName || "User";
      const photoSrc = user.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForAvatar)}&background=f5a623&color=000&bold=true`;

      // Inject navbar profile button & popup markup
      navAuthArea.innerHTML = `
        <div class="nav-user-wrapper" id="navUserWrapper">
          <button type="button" class="nav-user-btn" id="navUserBtn" aria-expanded="false" aria-haspopup="true" title="Account Menu">
            <img src="${photoSrc}" alt="${escapeHtml(nameForAvatar)}" class="nav-user-avatar" />
            <span class="nav-user-name">${escapeHtml(shortName)}</span>
            <i class="fas fa-chevron-down nav-user-caret"></i>
          </button>

          <div class="profile-popup" id="profilePopup" aria-hidden="true">
            <div class="profile-popup-header">
              <div class="profile-avatar-wrap">
                <img src="${photoSrc}" alt="${escapeHtml(nameForAvatar)}" class="profile-popup-avatar" />
                <span class="profile-status-indicator" title="Online"></span>
              </div>
              <div class="profile-popup-user-details">
                <h4 class="profile-popup-name">${escapeHtml(nameForAvatar)}</h4>
                <p class="profile-popup-email">${escapeHtml(email)}</p>
                <span class="profile-popup-badge"><i class="fas fa-shield-alt"></i> ${escapeHtml(userRole)}</span>
              </div>
            </div>

            <div class="profile-popup-divider"></div>

            <div class="profile-popup-body">
              <div class="profile-detail-row">
                <div class="detail-icon"><i class="fas fa-user"></i></div>
                <div class="detail-info">
                  <span class="detail-label">Username</span>
                  <span class="detail-value">${escapeHtml(displayName || shortName)}</span>
                </div>
              </div>

              <div class="profile-detail-row">
                <div class="detail-icon"><i class="fas fa-envelope"></i></div>
                <div class="detail-info">
                  <span class="detail-label">Email Address</span>
                  <span class="detail-value">${escapeHtml(email)}</span>
                </div>
              </div>

              ${joinedDateStr ? `
              <div class="profile-detail-row">
                <div class="detail-icon"><i class="fas fa-calendar-check"></i></div>
                <div class="detail-info">
                  <span class="detail-label">Member Since</span>
                  <span class="detail-value">${escapeHtml(joinedDateStr)}</span>
                </div>
              </div>` : ''}
            </div>

            <div class="profile-popup-divider"></div>

            <div class="profile-popup-actions">
              <a href="help.html#my-requests" class="profile-popup-action-btn secondary">
                <i class="fas fa-circle-question" style="color:var(--gold);"></i> My Help Requests &amp; Replies
              </a>
              <a href="chat.html" class="profile-popup-action-btn secondary">
                <i class="fas fa-comments" style="color:#2196f3;"></i> Live Chat Support
              </a>
              <button type="button" class="profile-logout-btn" id="navLogoutBtn">
                <i class="fas fa-sign-out-alt"></i> Log Out
              </button>
            </div>
          </div>
        </div>
      `;

      // Profile Popup Elements
      const wrapper = document.getElementById("navUserWrapper");
      const userBtn = document.getElementById("navUserBtn");
      const popup = document.getElementById("profilePopup");
      const logoutBtn = document.getElementById("navLogoutBtn");

      function openPopup() {
        if (!popup) return;
        popup.classList.add("active");
        userBtn?.classList.add("active");
        userBtn?.setAttribute("aria-expanded", "true");
        popup.setAttribute("aria-hidden", "false");
      }

      function closePopup() {
        if (!popup) return;
        popup.classList.remove("active");
        userBtn?.classList.remove("active");
        userBtn?.setAttribute("aria-expanded", "false");
        popup.setAttribute("aria-hidden", "true");
      }

      if (userBtn && popup) {
        userBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const isOpen = popup.classList.contains("active");
          isOpen ? closePopup() : openPopup();
        });
      }

      // Close popup when clicking outside
      const onOutsideClick = (e) => {
        if (wrapper && !wrapper.contains(e.target)) {
          closePopup();
        }
      };
      document.addEventListener("click", onOutsideClick);

      // Close popup on Escape key
      const onEscKey = (e) => {
        if (e.key === "Escape") closePopup();
      };
      document.addEventListener("keydown", onEscKey);

      // Logout handler
      if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
          try {
            closePopup();
            await firebase.auth().signOut();
            if (typeof showToast === "function") {
              showToast("Logged out successfully.", "success");
            }
            if (window.location.pathname.includes("chat.html")) {
              window.location.href = "login.html";
            }
          } catch (err) {
            console.error("Logout failed:", err);
            if (typeof showToast === "function") {
              showToast("Failed to log out. Please try again.", "error");
            }
          }
        });
      }
    });
  }

  // Initialize navbar auth listener
  initNavbarAuth();
})();
