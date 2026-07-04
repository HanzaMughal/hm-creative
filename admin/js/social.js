// =============================================
// social.js — HM Creative Admin Panel
// Manages Firestore /settings/socialLinks
// =============================================

const SOCIAL_DOC_PATH = "settings/socialLinks";

const PLATFORMS = {
  instagram:  { label: "Instagram",  icon: "fab fa-instagram",  color: "#E1306C", placeholder: "https://instagram.com/yourhandle" },
  facebook:   { label: "Facebook",   icon: "fab fa-facebook-f", color: "#1877F2", placeholder: "https://facebook.com/yourpage" },
  tiktok:     { label: "TikTok",     icon: "fab fa-tiktok",     color: "#ffffff", placeholder: "https://tiktok.com/@yourhandle" },
  youtube:    { label: "YouTube",    icon: "fab fa-youtube",    color: "#FF0000", placeholder: "https://youtube.com/@yourchannel" },
  twitter:    { label: "Twitter / X",icon: "fab fa-x-twitter",  color: "#ffffff", placeholder: "https://x.com/yourhandle" },
  linkedin:   { label: "LinkedIn",   icon: "fab fa-linkedin-in",color: "#0A66C2", placeholder: "https://linkedin.com/in/yourprofile" },
  whatsapp:   { label: "WhatsApp",   icon: "fab fa-whatsapp",   color: "#25D366", placeholder: "923001234567 (number only, no +)" },
  snapchat:   { label: "Snapchat",   icon: "fab fa-snapchat",   color: "#FFFC00", placeholder: "https://snapchat.com/add/yourname" },
  github:     { label: "GitHub",     icon: "fab fa-github",     color: "#ffffff", placeholder: "https://github.com/yourusername" },
  behance:    { label: "Behance",    icon: "fab fa-behance",    color: "#1769FF", placeholder: "https://behance.net/yourprofile" },
  pinterest:  { label: "Pinterest",  icon: "fab fa-pinterest",  color: "#E60023", placeholder: "https://pinterest.com/yourprofile" },
  fiverr:     { label: "Fiverr",     icon: "fas fa-dollar-sign",color: "#1DBF73", placeholder: "https://fiverr.com/yourusername" },
};

let currentLinks = {}; // { platform: value }

/* ─── DOM refs ─── */
const linksList     = document.getElementById("socialLinksList");
const previewArea   = document.getElementById("socialPreview");
const platformSel   = document.getElementById("platformSelect");
const linkInput     = document.getElementById("linkInput");
const linkLabel     = document.getElementById("linkLabel");
const addLinkForm   = document.getElementById("addLinkForm");
const saveAllBtn    = document.getElementById("saveAllBtn");

/* ─── Auth guard + init ─── */
adminAuthGuard(() => {
  populatePlatformDropdown();
  loadSocialLinks();
});

/* ─── Populate platform dropdown ─── */
function populatePlatformDropdown() {
  if (!platformSel) return;
  platformSel.innerHTML = `<option value="">— Select Platform —</option>` +
    Object.entries(PLATFORMS).map(([key, p]) =>
      `<option value="${key}">${p.label}</option>`
    ).join("");
}

/* ─── Platform selection → update placeholder/label ─── */
platformSel?.addEventListener("change", () => {
  const key = platformSel.value;
  if (!key || !PLATFORMS[key]) { linkInput && (linkInput.placeholder = ""); return; }
  const p = PLATFORMS[key];
  if (linkInput) linkInput.placeholder = p.placeholder;
  if (linkLabel) linkLabel.textContent = key === "whatsapp" ? "Phone Number" : "URL";
});

/* ─── Load from Firestore ─── */
async function loadSocialLinks() {
  showSkeleton();
  try {
    const snap = await db.collection("settings").doc("socialLinks").get();
    currentLinks = snap.exists ? (snap.data() || {}) : {};
    renderLinksList();
    renderPreview();
  } catch (err) {
    showToast("Failed to load social links: " + err.message, "error");
    if (linksList) linksList.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load</p></div>`;
  }
}

/* ─── Render saved links list ─── */
function renderLinksList() {
  if (!linksList) return;
  const entries = Object.entries(currentLinks).filter(([, v]) => v);

  if (!entries.length) {
    linksList.innerHTML = `<div class="empty-state"><i class="fas fa-link-slash"></i><p>No social links added yet.</p></div>`;
    return;
  }

  linksList.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Platform</th>
          <th>Value</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(([key, val]) => {
          const p   = PLATFORMS[key] || { label: key, icon: "fas fa-link", color: "#f5a623" };
          const display = key === "whatsapp"
            ? `+${String(val).replace(/\D/g, "")}`
            : val;
          return `
            <tr>
              <td>
                <span class="platform-chip" style="--chip-color:${p.color}">
                  <i class="${p.icon}"></i> ${p.label}
                </span>
              </td>
              <td class="link-val-cell">
                <a href="${key === 'whatsapp' ? 'https://wa.me/' + String(val).replace(/\D/g,'') : val}"
                   target="_blank" rel="noopener" class="link-preview-text">
                  ${escHtml(display)}
                </a>
              </td>
              <td>
                <button class="action-btn edit-social-btn" onclick="editLink('${key}','${escHtml(val)}')" title="Edit">
                  <i class="fas fa-pen"></i>
                </button>
                <button class="action-btn delete-btn" onclick="deleteLink('${key}')" title="Remove">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

/* ─── Render icon preview ─── */
function renderPreview() {
  if (!previewArea) return;
  const entries = Object.entries(currentLinks).filter(([, v]) => v);

  if (!entries.length) {
    previewArea.innerHTML = `<p class="preview-empty">No links to preview yet.</p>`;
    return;
  }

  previewArea.innerHTML = entries.map(([key, val]) => {
    const p = PLATFORMS[key] || { icon: "fas fa-link", color: "#f5a623", label: key };
    return `
      <a class="preview-icon-btn" style="--ic:${p.color}"
         href="${key === 'whatsapp' ? 'https://wa.me/' + String(val).replace(/\D/g,'') : val}"
         target="_blank" rel="noopener" title="${p.label}">
        <i class="${p.icon}"></i>
      </a>`;
  }).join("");
}

/* ─── Add / update link ─── */
addLinkForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const key = platformSel?.value;
  const val = linkInput?.value?.trim();

  if (!key)  { showToast("Please select a platform.", "error"); return; }
  if (!val)  { showToast("Please enter a value.", "error"); return; }

  const btn = document.getElementById("addLinkBtn");
  setLoading(btn, true);
  try {
    currentLinks[key] = val;
    await db.collection("settings").doc("socialLinks").set(currentLinks, { merge: false });
    showToast("Link saved!", "success");
    renderLinksList();
    renderPreview();
    addLinkForm.reset();
    if (linkInput) linkInput.placeholder = "";
    if (linkLabel) linkLabel.textContent = "URL / Value";
  } catch (err) {
    showToast("Save failed: " + err.message, "error");
  } finally {
    setLoading(btn, false);
  }
});

/* ─── Pre-fill form to edit a link ─── */
function editLink(key, val) {
  if (!platformSel || !linkInput) return;
  platformSel.value = key;
  platformSel.dispatchEvent(new Event("change"));
  linkInput.value = val;
  linkInput.focus();
}

/* ─── Delete a link ─── */
async function deleteLink(key) {
  if (!confirm(`Remove ${PLATFORMS[key]?.label || key} link?`)) return;
  delete currentLinks[key];
  try {
    await db.collection("settings").doc("socialLinks").set(currentLinks, { merge: false });
    showToast("Link removed.", "success");
    renderLinksList();
    renderPreview();
  } catch (err) {
    showToast("Remove failed: " + err.message, "error");
    loadSocialLinks(); // re-sync
  }
}

/* ─── Skeleton loader ─── */
function showSkeleton() {
  if (linksList) linksList.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.75rem;">
      ${Array(3).fill('<div class="skeleton" style="height:48px;border-radius:10px;"></div>').join("")}
    </div>`;
}

/* ─── Helpers ─── */
function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
