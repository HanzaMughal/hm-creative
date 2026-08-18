// =============================================
// package-detail.js — Dynamic Package Detail Page
// =============================================

/* ── Utility: safe HTML escaping ── */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let currentPackage = null;
let currentPackageKey = null;

const DEFAULT_SAMPLE_PACKAGES_MAP = {
  "def_pkg_1": {
    key: "def_pkg_1",
    name: "Starter Video Ad Pack",
    price: "PKR 25,000",
    badge: "Popular",
    category: "ad",
    description: "Perfect for small businesses looking for a high-converting digital video ad.",
    features: "1 High-Impact Video Ad (15-30s)\nProfessional Motion Graphics\nCustom Script & Voiceover\nHD 1080p Export\n3 Days Fast Delivery\n2 Revisions Included",
    delivery: "3 Days Delivery",
    revisions: "2 Revisions",
    icon: "fas fa-film",
    bgImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    adDetails: {
      duration: "15-30 Seconds",
      resolution: "1080p Full HD",
      aspectRatio: "9:16 Vertical & 16:9 Landscape",
      voiceover: "Custom Script & Voiceover Included",
      motionGraphics: "2D Motion & Visual FX",
      platforms: "Meta Ads, Instagram Reels, TikTok"
    },
    additionalCosts: [
      { service: "Social Media Pixel Tracking Setup", price: "PKR 5,000", note: "Meta & TikTok pixel installation" }
    ]
  },
  "def_pkg_2": {
    key: "def_pkg_2",
    name: "Pro Performance Campaign",
    price: "PKR 65,000",
    badge: "Most Popular",
    category: "ad",
    description: "Complete ad suite for scaling brands across Meta, Instagram, & TikTok.",
    features: "3 Variations of Video Ads (A/B testing ready)\nCustom Thumbnail Designs\nPremium Voiceover & Sound Design\nFull HD & Vertical Formats (9:16 + 16:9)\n5 Days Delivery\nUnlimited Revisions",
    delivery: "5 Days Delivery",
    revisions: "Unlimited Revisions",
    icon: "fas fa-clapperboard",
    bgImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    adDetails: {
      duration: "30-60 Seconds (3 Variations)",
      resolution: "4K & 1080p Full HD",
      aspectRatio: "9:16 Vertical, 16:9 & 1:1 Square",
      voiceover: "Professional Copywriting & Studio Voiceover",
      motionGraphics: "Advanced 2D/3D VFX & Motion Graphics",
      platforms: "Meta Ads, TikTok, YouTube, Instagram"
    },
    additionalCosts: [
      { service: "Ad Copy & Funnel Setup", price: "PKR 10,000", note: "High-converting ad script & headline copywriting" }
    ]
  },
  "def_pkg_web1": {
    key: "def_pkg_web1",
    name: "Starter Website Package",
    price: "PKR 35,000",
    badge: "Basic",
    category: "website",
    description: "Ideal for small businesses needing a clean, modern, and responsive web presence.",
    features: "Custom Responsive Web Design\nDomain & Hosting Setup\nFree SSL Certificate\nSEO-Friendly Structure\n3 Days Delivery\n2 Revisions Included",
    delivery: "3 Days Delivery",
    revisions: "2 Revisions",
    icon: "fas fa-globe",
    bgImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    hostingDetails: {
      provider: "Hostinger",
      planName: "Single Shared Hosting",
      storage: "50 GB SSD",
      bandwidth: "100 GB",
      websites: "1 Website",
      email: "1 Email Account",
      ssl: true,
      cdn: false,
      notes: "Includes free SSL certificate & 99.9% uptime guarantee."
    },
    domainDetails: {
      included: true,
      extension: ".com / .pk",
      notes: "Free domain registration for the 1st year.",
      pricing: [
        { duration: "1 Year",  hosting: "PKR 3,500",  domain: "PKR 2,200" },
        { duration: "2 Years", hosting: "PKR 6,000",  domain: "PKR 4,000" },
        { duration: "3 Years", hosting: "PKR 8,500",  domain: "PKR 5,800" },
        { duration: "4 Years", hosting: "PKR 10,800", domain: "PKR 7,200" }
      ]
    },
    additionalCosts: [
      { service: "Monthly Site Maintenance", price: "PKR 5,000/mo", note: "Includes weekly updates & security patches" }
    ]
  },
  "def_pkg_web2": {
    key: "def_pkg_web2",
    name: "Pro Business Suite",
    price: "PKR 75,000",
    badge: "Most Popular",
    category: "website",
    description: "Complete web solution with high performance cloud hosting and domain suite.",
    features: "Dynamic Web Application\nFree Domain & Premium Hosting (1 Yr)\nDatabase & API Integration\nSpeed Optimization & Security\n5 Days Delivery\nUnlimited Revisions",
    delivery: "5 Days Delivery",
    revisions: "Unlimited Revisions",
    icon: "fas fa-rocket",
    bgImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    hostingDetails: {
      provider: "Hostinger Business",
      planName: "Business Cloud",
      storage: "200 GB NVMe SSD",
      bandwidth: "Unlimited Unmetered",
      websites: "100 Websites",
      email: "100 Free Accounts",
      ssl: true,
      cdn: true,
      notes: "24/7 Priority VIP Support, Automated Daily Backups, & Global CDN."
    },
    domainDetails: {
      included: true,
      extension: ".com / .pk / .org",
      notes: "Free domain registration for 2 years with DNS management.",
      pricing: [
        { duration: "1 Year",  hosting: "PKR 7,500",  domain: "Free" },
        { duration: "2 Years", hosting: "PKR 13,000", domain: "Free" },
        { duration: "3 Years", hosting: "PKR 18,000", domain: "PKR 3,000" },
        { duration: "4 Years", hosting: "PKR 22,000", domain: "PKR 5,000" }
      ]
    },
    additionalCosts: [
      { service: "SEO & Google Indexing Setup", price: "PKR 15,000", note: "Comprehensive Technical & On-Page SEO" }
    ]
  }
};

// Aliases for fallback map compatibility
DEFAULT_SAMPLE_PACKAGES_MAP["def_pkg_ad1"] = DEFAULT_SAMPLE_PACKAGES_MAP["def_pkg_1"];
DEFAULT_SAMPLE_PACKAGES_MAP["def_pkg_ad2"] = DEFAULT_SAMPLE_PACKAGES_MAP["def_pkg_2"];

document.addEventListener("DOMContentLoaded", () => {
  initPackageDetailPage();
});

function initPackageDetailPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const pkgKey = urlParams.get("key") || urlParams.get("id");

  if (!pkgKey) {
    showPackageNotFound("No package key provided in URL.");
    return;
  }

  currentPackageKey = pkgKey;
  fetchPackageData(pkgKey);
  setupOrderModalListeners();
}

function fetchPackageData(pkgKey) {
  // 1. Try fetching directly from Firebase Realtime Database node /packages/{pkgKey}
  rtdb.ref("packages/" + pkgKey).once("value")
    .then((snap) => {
      let data = snap.val();
      if (data) {
        currentPackage = { key: pkgKey, ...data };
        renderPackageDetails(currentPackage);
        return;
      }

      // 2. Search entire /packages collection for matching key, name, or order property
      rtdb.ref("packages").once("value").then((allSnap) => {
        const all = allSnap.val() || {};
        const foundKey = Object.keys(all).find(k => k === pkgKey || all[k].name === pkgKey || String(all[k].order) === pkgKey);
        if (foundKey) {
          currentPackage = { key: foundKey, ...all[foundKey] };
          renderPackageDetails(currentPackage);
          return;
        }

        // 3. Fallback check in default sample packages map
        if (DEFAULT_SAMPLE_PACKAGES_MAP[pkgKey]) {
          currentPackage = { key: pkgKey, ...DEFAULT_SAMPLE_PACKAGES_MAP[pkgKey] };
          renderPackageDetails(currentPackage);
        } else {
          showPackageNotFound("Requested package configuration could not be found.");
        }
      });
    })
    .catch(() => {
      if (DEFAULT_SAMPLE_PACKAGES_MAP[pkgKey]) {
        currentPackage = { key: pkgKey, ...DEFAULT_SAMPLE_PACKAGES_MAP[pkgKey] };
        renderPackageDetails(currentPackage);
      } else {
        showPackageNotFound("Error retrieving package information.");
      }
    });
}

function renderPackageDetails(pkg) {
  document.title = `${pkg.name || "Package Details"} — HM Creative`;

  // Hero Ambient Blurred Background Image
  const blurImgEl = document.getElementById("pkgAmbientBlurImage");
  if (blurImgEl) {
    const bgUrl = pkg.bgImage || pkg.image || "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80";
    blurImgEl.style.backgroundImage = `url('${bgUrl}')`;
  }

  // Showcase Icon Box
  const iconBox = document.getElementById("pkgShowcaseIcon");
  if (iconBox) {
    iconBox.innerHTML = `<i class="${escapeHtml(pkg.icon || (pkg.category === 'ad' ? 'fas fa-film' : 'fas fa-box-open'))}"></i>`;
  }

  // Badge Tag
  const badgeWrap = document.getElementById("pkgBadgeWrap");
  const badgeText = document.getElementById("pkgBadgeText");
  if (badgeWrap && badgeText) {
    if (pkg.badge) {
      badgeText.textContent = pkg.badge;
      badgeWrap.style.display = "block";
    } else if (pkg.featured) {
      badgeText.textContent = "Featured Package";
      badgeWrap.style.display = "block";
    } else {
      badgeWrap.style.display = "none";
    }
  }

  // Header Title & Price
  const nameEl  = document.getElementById("pkgName");
  const priceEl = document.getElementById("pkgPrice");
  const sidePriceEl = document.getElementById("sidePkgPrice");
  const descEl  = document.getElementById("pkgDescription");

  if (nameEl)  nameEl.textContent  = pkg.name || "Package Details";
  if (priceEl) priceEl.textContent = pkg.price || "";
  if (sidePriceEl) sidePriceEl.textContent = pkg.price || "";
  if (descEl)  descEl.textContent  = pkg.description || "No description provided for this package.";

  // Features Checklist
  const featuresList = document.getElementById("pkgFeaturesList");
  if (featuresList) {
    const feats = (pkg.features || '').split('\n').filter(f => f.trim() !== '');
    if (feats.length === 0) {
      featuresList.innerHTML = `<li style="color:var(--text-dim);font-size:0.9rem;">Standard package deliverables included.</li>`;
    } else {
      featuresList.innerHTML = feats.map(f =>
        `<li style="font-size:0.93rem;color:var(--text-muted);margin-bottom:0.75rem;display:flex;align-items:flex-start;gap:0.65rem;line-height:1.5;">
          <i class="fas fa-check-circle" style="color:var(--gold);font-size:0.95rem;margin-top:0.15rem;flex-shrink:0;"></i>
          <span>${escapeHtml(f.trim())}</span>
        </li>`
      ).join('');
    }
  }

  // ── SECTION 1: Hosting Details ──
  const hostingSection = document.getElementById("pkgHostingSection");
  const hostingBody    = document.getElementById("pkgHostingBody");
  const hostNotes      = document.getElementById("pkgHostingNotes");
  const h = pkg.hostingDetails || {};

  if (hostingSection && hostingBody) {
    const hasHost = h.provider || h.planName || h.storage || h.bandwidth;
    if (hasHost) {
      hostingSection.style.display = "block";
      const hostItems = [
        { label: "Provider", value: h.provider, icon: "fas fa-building" },
        { label: "Plan Name", value: h.planName, icon: "fas fa-layer-group" },
        { label: "Storage", value: h.storage, icon: "fas fa-hard-drive" },
        { label: "Bandwidth", value: h.bandwidth, icon: "fas fa-gauge-high" },
        { label: "Websites Allowed", value: h.websites, icon: "fas fa-globe" },
        { label: "Email Accounts", value: h.email, icon: "fas fa-envelope" },
        { label: "Free SSL Certificate", value: h.ssl ? "Included ✅" : "Optional Addon", icon: "fas fa-lock" },
        { label: "Free CDN Network", value: h.cdn ? "Included ✅" : "Not Included", icon: "fas fa-network-wired" }
      ].filter(item => item.value);

      hostingBody.innerHTML = hostItems.map(item =>
        `<div style="background:var(--surface2);padding:0.75rem 0.95rem;border-radius:12px;border:1px solid var(--border);">
          <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-dim);font-weight:600;display:flex;align-items:center;gap:0.35rem;margin-bottom:0.25rem;">
            <i class="${item.icon}" style="color:var(--gold);"></i> ${escapeHtml(item.label)}
          </div>
          <div style="font-size:0.86rem;color:var(--text);font-weight:600;margin-top:0.1rem;">${escapeHtml(item.value)}</div>
        </div>`
      ).join('');

      if (h.notes && hostNotes) {
        hostNotes.style.display = "block";
        hostNotes.innerHTML = `<i class="fas fa-circle-info" style="color:var(--gold);margin-right:0.4rem;"></i>${escapeHtml(h.notes)}`;
      } else if (hostNotes) {
        hostNotes.style.display = "none";
      }
    } else {
      hostingSection.style.display = "none";
    }
  }

  // ── SECTION 2: Domain Details & Duration Pricing Matrix ──
  const domainSection   = document.getElementById("pkgDomainSection");
  const domainMeta      = document.getElementById("pkgDomainMeta");
  const domNotes        = document.getElementById("pkgDomainNotes");
  const tableWrap       = document.getElementById("pkgPricingTableWrap");
  const tableBody       = document.getElementById("pkgPricingTableBody");
  const d = pkg.domainDetails || {};

  if (domainSection) {
    const hasDomain = d.extension || (Array.isArray(d.pricing) && d.pricing.length > 0);
    if (hasDomain) {
      domainSection.style.display = "block";

      if (domainMeta) {
        domainMeta.innerHTML = `
          ${d.included !== false ? `<span style="background:rgba(245,166,35,0.15);color:var(--gold);border:1px solid rgba(245,166,35,0.3);padding:0.25rem 0.8rem;border-radius:99px;font-size:0.78rem;font-weight:700;"><i class="fas fa-check"></i> Domain Included</span>` : ''}
          ${d.extension ? `<span style="background:rgba(245,166,35,0.1);color:var(--gold);border:1px solid rgba(245,166,35,0.2);padding:0.25rem 0.8rem;border-radius:99px;font-size:0.78rem;font-weight:600;">${escapeHtml(d.extension)}</span>` : ''}
        `;
      }

      if (d.notes && domNotes) {
        domNotes.style.display = "block";
        domNotes.innerHTML = `<i class="fas fa-circle-info" style="color:var(--gold);margin-right:0.4rem;"></i>${escapeHtml(d.notes)}`;
      } else if (domNotes) {
        domNotes.style.display = "none";
      }

      if (Array.isArray(d.pricing) && d.pricing.length > 0 && tableWrap && tableBody) {
        tableWrap.style.display = "block";
        tableBody.innerHTML = d.pricing.map(row => {
          const hVal = row.hosting || '—';
          const dVal = row.domain  || '—';
          const hNum = parseInt(String(row.hosting || '').replace(/[^0-9]/g, ''), 10) || 0;
          const dNum = parseInt(String(row.domain  || '').replace(/[^0-9]/g, ''), 10) || 0;
          const totNum = hNum + dNum;
          const totalHtml = totNum > 0 ? `<strong style="color:var(--gold);">PKR ${totNum.toLocaleString()}</strong>` : '—';

          return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:0.7rem 1rem;font-weight:600;color:var(--text);font-size:0.84rem;">${escapeHtml(row.duration || '')}</td>
            <td style="padding:0.7rem 1rem;color:var(--text-muted);font-size:0.84rem;">${escapeHtml(hVal)}</td>
            <td style="padding:0.7rem 1rem;color:var(--text-muted);font-size:0.84rem;">${escapeHtml(dVal)}</td>
            <td style="padding:0.7rem 1rem;font-size:0.84rem;">${totalHtml}</td>
          </tr>`;
        }).join('');
      } else if (tableWrap) {
        tableWrap.style.display = "none";
      }
    } else {
      domainSection.style.display = "none";
    }
  }

  // ── SECTION 3: Ad Specifications & Video Deliverables ──
  const adSection = document.getElementById("pkgAdSection");
  const adBody    = document.getElementById("pkgAdBody");
  const ad = pkg.adDetails || {};
  const hasAdSpecs = ad.duration || ad.resolution || ad.aspectRatio || ad.voiceover || ad.motionGraphics || ad.platforms;

  if (adSection && adBody) {
    if (hasAdSpecs || pkg.category === 'ad') {
      adSection.style.display = "block";
      const adItems = [
        { label: "Video Duration", value: ad.duration || "15-30 Seconds", icon: "fas fa-stopwatch" },
        { label: "Resolution", value: ad.resolution || "1080p Full HD", icon: "fas fa-expand" },
        { label: "Aspect Ratio(s)", value: ad.aspectRatio || "9:16 Vertical & 16:9 Landscape", icon: "fas fa-mobile-screen" },
        { label: "Script & Voiceover", value: ad.voiceover || "Custom Script & Voiceover Included", icon: "fas fa-microphone" },
        { label: "Motion Graphics", value: ad.motionGraphics || "2D Motion FX", icon: "fas fa-wand-magic-sparkles" },
        { label: "Target Platforms", value: ad.platforms || "Meta Ads, TikTok, YouTube", icon: "fas fa-share-nodes" }
      ];

      adBody.innerHTML = adItems.map(item => `
        <div style="background:var(--surface2);padding:0.75rem 0.95rem;border-radius:12px;border:1px solid var(--border);">
          <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-dim);font-weight:600;display:flex;align-items:center;gap:0.35rem;margin-bottom:0.25rem;">
            <i class="${item.icon}" style="color:var(--gold);"></i> ${escapeHtml(item.label)}
          </div>
          <div style="font-size:0.88rem;color:var(--text);font-weight:600;">${escapeHtml(item.value)}</div>
        </div>
      `).join('');
    } else {
      adSection.style.display = "none";
    }
  }

  // ── SECTION 4: Additional Services & Addons ──
  const addonsSection = document.getElementById("pkgAddonsSection");
  const addonsBody    = document.getElementById("pkgAddonsBody");
  const addons = (Array.isArray(pkg.additionalCosts) && pkg.additionalCosts.length > 0)
    ? pkg.additionalCosts
    : [];

  if (addonsSection && addonsBody) {
    if (addons.length > 0) {
      addonsSection.style.display = "block";
      addonsBody.innerHTML = addons.map(item =>
        `<div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border-radius:10px;padding:0.65rem 0.95rem;gap:1rem;border:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:0.6rem;">
            <i class="fas fa-circle-dot" style="color:var(--gold);font-size:0.75rem;flex-shrink:0;"></i>
            <div>
              <div style="font-size:0.86rem;color:var(--text);font-weight:600;">${escapeHtml(item.service || '')}</div>
              ${item.note ? `<div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.1rem;">${escapeHtml(item.note)}</div>` : ''}
            </div>
          </div>
          ${item.price ? `<div style="font-size:0.86rem;font-weight:700;color:var(--gold);white-space:nowrap;">${escapeHtml(item.price)}</div>` : ''}
        </div>`
      ).join('');
    } else {
      addonsSection.style.display = "none";
    }
  }

  // Sidebar Specs
  const sideSpecs = document.getElementById("sidePkgSpecs");
  if (sideSpecs) {
    sideSpecs.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.6rem;">
        <i class="fas fa-truck-fast" style="color:var(--gold);width:18px;"></i>
        <span><strong>Delivery:</strong> ${escapeHtml(pkg.delivery || "Standard 3-5 Days")}</span>
      </div>
      <div style="display:flex;align-items:center;gap:0.6rem;">
        <i class="fas fa-rotate" style="color:var(--gold);width:18px;"></i>
        <span><strong>Revisions:</strong> ${escapeHtml(pkg.revisions || "2 Revisions Included")}</span>
      </div>
      <div style="display:flex;align-items:center;gap:0.6rem;">
        <i class="fas fa-headset" style="color:var(--gold);width:18px;"></i>
        <span><strong>Support:</strong> Priority 1-on-1 Assistance</span>
      </div>
    `;
  }
}

function setupOrderModalListeners() {
  const orderModal = document.getElementById("packageOrderModal");

  document.getElementById("orderPkgBtn")?.addEventListener("click", () => {
    if (!currentPackage) return;
    openOrderModal();
  });

  document.getElementById("closeOrderModal")?.addEventListener("click", closeOrderModal);
  document.getElementById("cancelOrderBtn")?.addEventListener("click", closeOrderModal);
  orderModal?.addEventListener("click", (e) => {
    if (e.target && e.target.id === "packageOrderModal") closeOrderModal();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOrderModal();
  });

  document.getElementById("confirmOrderBtn")?.addEventListener("click", async () => {
    const user = firebase.auth().currentUser;
    if (!currentPackage) return;

    if (!user) {
      sessionStorage.setItem("pendingOrder", JSON.stringify({ packageId: currentPackageKey }));
      sessionStorage.setItem("redirectAfterLogin", window.location.href);
      window.location.href = "login.html";
      return;
    }

    const notes = document.getElementById("orderNotesInput")?.value.trim() || "";
    const btn   = document.getElementById("confirmOrderBtn");

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Placing Order...`;

    try {
      let userName = user.displayName;
      try {
        const snap = await db.collection("users").doc(user.uid).get();
        if (snap.exists && snap.data().name) userName = snap.data().name;
      } catch (e) {}

      const orderObj = {
        userId: user.uid,
        userName: userName || user.email || "Customer",
        userEmail: user.email || "",
        packageId: currentPackageKey,
        packageName: currentPackage.name || "Package",
        packagePrice: currentPackage.price || "Contact for Price",
        packageDetails: currentPackage,
        notes: notes,
        status: "Pending",
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };

      await rtdb.ref("orders").push(orderObj);
      if (typeof playNotificationSound === "function") playNotificationSound();

      showToast("Order placed successfully! We will contact you shortly.", "success");
      closeOrderModal();
    } catch (err) {
      showToast("Failed to place order: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-check"></i> Place Order Now`;
    }
  });
}

function openOrderModal() {
  const user = firebase.auth().currentUser;
  if (!user) {
    sessionStorage.setItem("pendingOrder", JSON.stringify({ packageId: currentPackageKey }));
    sessionStorage.setItem("redirectAfterLogin", window.location.href);
    window.location.href = "login.html";
    return;
  }

  const orderModal = document.getElementById("packageOrderModal");
  const detailsEl  = document.getElementById("orderModalPkgDetails");

  if (detailsEl && currentPackage) {
    const featuresSummary = (currentPackage.features || '').split('\n').filter(f => f.trim()).map(f => `• ${f.trim()}`).join('\n');
    detailsEl.innerHTML = `
      <div style="margin-bottom:0.5rem;"><strong>Package:</strong> ${escapeHtml(currentPackage.name)} — <strong style="color:var(--gold)">${escapeHtml(currentPackage.price)}</strong></div>
      ${currentPackage.delivery ? `<div><i class="fas fa-truck-fast"></i> ${escapeHtml(currentPackage.delivery)}${currentPackage.revisions ? ` &nbsp;|&nbsp; <i class="fas fa-rotate"></i> ${escapeHtml(currentPackage.revisions)}` : ''}</div>` : ''}
      ${featuresSummary ? `<div style="margin-top:0.4rem;white-space:pre-line;font-size:0.82rem;">${escapeHtml(featuresSummary)}</div>` : ''}
    `;
  }

  if (orderModal) {
    orderModal.classList.add("open");
    document.body.style.overflow = "hidden";
  }
}

function closeOrderModal() {
  const orderModal = document.getElementById("packageOrderModal");
  if (orderModal) {
    orderModal.classList.remove("open");
    document.body.style.overflow = "";
  }
}

function showPackageNotFound(message) {
  const container = document.querySelector(".package-detail-section .container");
  if (container) {
    container.innerHTML = `
      <div style="text-align:center;padding:5rem 1rem;">
        <i class="fas fa-box-open" style="font-size:3.5rem;color:var(--gold);opacity:0.4;margin-bottom:1rem;display:block;"></i>
        <h2 style="font-size:1.6rem;color:var(--text);margin-bottom:0.5rem;">Package Not Found</h2>
        <p style="color:var(--text-dim);max-width:460px;margin:0 auto 1.5rem;">${escapeHtml(message)}</p>
        <a href="index.html#offers" class="btn btn-gold btn-sm"><i class="fas fa-arrow-left"></i> Return to All Offers</a>
      </div>
    `;
  }
}
