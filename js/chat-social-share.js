// =============================================
// chat-social-share.js — HM Creative
// Social Media Quick-Share (@ Mention) Module
// Provides dynamic popup, composer attachment, and clickable card rendering
// =============================================

(function (window) {
  "use strict";

  // Default fallback catalog if Firestore has not yet been populated
  const DEFAULT_PLATFORMS = [
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: "fab fa-whatsapp",
      color: "#25D366",
      url: "https://wa.me/923001234567",
      actionText: "Click to contact us"
    },
    {
      id: "instagram",
      name: "Instagram",
      icon: "fab fa-instagram",
      color: "#E1306C",
      url: "https://instagram.com/hmcreative",
      actionText: "Visit our Instagram"
    },
    {
      id: "facebook",
      name: "Facebook",
      icon: "fab fa-facebook-f",
      color: "#1877F2",
      url: "https://facebook.com/hmcreative",
      actionText: "Visit our Facebook"
    },
    {
      id: "tiktok",
      name: "TikTok",
      icon: "fab fa-tiktok",
      color: "#ffffff",
      url: "https://tiktok.com/@hmcreative",
      actionText: "Watch on TikTok"
    },
    {
      id: "youtube",
      name: "YouTube",
      icon: "fab fa-youtube",
      color: "#FF0000",
      url: "https://youtube.com/@hmcreative",
      actionText: "Subscribe on YouTube"
    },
    {
      id: "telegram",
      name: "Telegram",
      icon: "fab fa-telegram",
      color: "#229ED9",
      url: "https://t.me/hmcreative",
      actionText: "Message on Telegram"
    }
  ];

  class ChatSocialShare {
    constructor(options = {}) {
      this.inputEl        = options.inputEl;
      this.popupEl        = options.popupEl;
      this.attachmentEl   = options.attachmentEl;
      this.onAttach       = options.onAttach || null;
      this.onDetach       = options.onDetach || null;

      this.platforms      = [...DEFAULT_PLATFORMS];
      this.filteredItems  = [];
      this.activeIndex    = 0;
      this.isOpen         = false;
      this.attachedItem   = null;
      this.activeMention  = null; // { query, start, end }

      this.initFirestoreSync();
      this.initListeners();
    }

    /* ─── Sync with Firestore settings/socialLinks ─── */
    initFirestoreSync() {
      if (typeof db === "undefined" || !db.collection) {
        console.warn("[ChatSocialShare] Firestore db not found; using defaults.");
        return;
      }

      try {
        db.collection("settings").doc("socialLinks").onSnapshot((snap) => {
          if (!snap.exists) return;
          const data = snap.data() || {};
          const loaded = [];

          Object.entries(data).forEach(([key, val]) => {
            if (!val) return;
            const isObj = typeof val === "object";
            const rawUrl = isObj ? (val.url || val.link || "") : String(val);
            if (!rawUrl) return;

            const name = isObj && val.name ? val.name : (key.charAt(0).toUpperCase() + key.slice(1));
            const icon = isObj && val.icon ? val.icon : this.guessIcon(key);
            const color = isObj && val.color ? val.color : this.guessColor(key);

            const isWhatsApp = key === "whatsapp" || name.toLowerCase().includes("whatsapp");
            const finalUrl = isWhatsApp && !rawUrl.startsWith("http")
              ? "https://wa.me/" + String(rawUrl).replace(/\D/g, "")
              : (rawUrl.startsWith("http") || rawUrl.startsWith("tel:") ? rawUrl : "https://" + rawUrl);

            const actionText = isWhatsApp
              ? "Click to contact us"
              : `Click to open ${name}`;

            loaded.push({
              id: key,
              name,
              icon,
              color,
              url: finalUrl,
              actionText
            });
          });

          if (loaded.length > 0) {
            this.platforms = loaded;
          }
        }, (err) => {
          console.warn("[ChatSocialShare] Firestore listen error, using cached/defaults:", err);
        });
      } catch (e) {
        console.warn("[ChatSocialShare] Firestore sync failed:", e);
      }
    }

    guessIcon(key) {
      const k = key.toLowerCase();
      if (k.includes("whatsapp")) return "fab fa-whatsapp";
      if (k.includes("instagram")) return "fab fa-instagram";
      if (k.includes("facebook")) return "fab fa-facebook-f";
      if (k.includes("tiktok")) return "fab fa-tiktok";
      if (k.includes("youtube")) return "fab fa-youtube";
      if (k.includes("telegram")) return "fab fa-telegram";
      if (k.includes("twitter") || k === "x") return "fab fa-x-twitter";
      if (k.includes("linkedin")) return "fab fa-linkedin-in";
      if (k.includes("snapchat")) return "fab fa-snapchat";
      if (k.includes("phone")) return "fas fa-phone";
      return "fas fa-link";
    }

    guessColor(key) {
      const k = key.toLowerCase();
      if (k.includes("whatsapp")) return "#25D366";
      if (k.includes("instagram")) return "#E1306C";
      if (k.includes("facebook")) return "#1877F2";
      if (k.includes("tiktok")) return "#ffffff";
      if (k.includes("youtube")) return "#FF0000";
      if (k.includes("telegram")) return "#229ED9";
      if (k.includes("linkedin")) return "#0A66C2";
      if (k.includes("snapchat")) return "#FFFC00";
      return "#f5a623";
    }

    /* ─── DOM Listeners ─── */
    initListeners() {
      if (!this.inputEl) return;

      // Input listener for detecting @
      this.inputEl.addEventListener("input", () => this.handleInput());
      this.inputEl.addEventListener("click", () => this.handleInput());

      // Keydown listener for navigating popup
      this.inputEl.addEventListener("keydown", (e) => this.handleKeydown(e));

      // Close popup on outside click
      document.addEventListener("click", (e) => {
        if (!this.isOpen) return;
        if (!this.popupEl?.contains(e.target) && e.target !== this.inputEl) {
          this.closePopup();
        }
      });
    }

    /* ─── Detect @ trigger ─── */
    handleInput() {
      if (!this.inputEl) return;
      const text = this.inputEl.value || "";
      const cursorPos = this.inputEl.selectionStart || 0;
      const textBefore = text.slice(0, cursorPos);

      // Match @mention at start of input or after whitespace
      const match = textBefore.match(/(?:^|\s)@([a-zA-Z0-9_\s-]*)$/);

      if (match) {
        const query = match[1].toLowerCase().trim();
        const atIndex = textBefore.lastIndexOf("@");
        this.activeMention = { query, atIndex, cursorPos };
        this.filterAndRender(query);
      } else {
        if (this.isOpen) this.closePopup();
      }
    }

    /* ─── Keydown navigation ─── */
    handleKeydown(e) {
      if (!this.isOpen || !this.filteredItems.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.activeIndex = (this.activeIndex + 1) % this.filteredItems.length;
        this.updateActiveHighlight();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.activeIndex = (this.activeIndex - 1 + this.filteredItems.length) % this.filteredItems.length;
        this.updateActiveHighlight();
      } else if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
        e.preventDefault();
        const selected = this.filteredItems[this.activeIndex];
        if (selected) {
          this.selectPlatform(selected);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.closePopup();
      }
    }

    /* ─── Filter & Render Popup ─── */
    filterAndRender(query) {
      this.filteredItems = this.platforms.filter((p) => {
        return (
          p.name.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query) ||
          (p.actionText && p.actionText.toLowerCase().includes(query))
        );
      });

      this.activeIndex = 0;
      this.renderPopup();
      this.openPopup();
    }

    renderPopup() {
      if (!this.popupEl) return;

      if (!this.filteredItems.length) {
        this.popupEl.innerHTML = `
          <div class="chat-social-popup-header">
            <span><i class="fas fa-share-nodes"></i> Share Social Media</span>
            <span class="chat-social-popup-hint">esc to dismiss</span>
          </div>
          <div class="chat-social-popup-empty">
            <i class="fas fa-search"></i>
            <p>No matching platform found</p>
          </div>
        `;
        return;
      }

      let itemsHTML = this.filteredItems.map((item, idx) => {
        const isActive = idx === this.activeIndex ? "active" : "";
        return `
          <div class="chat-social-popup-item ${isActive}" data-index="${idx}" style="--item-color:${item.color};">
            <div class="popup-item-icon">
              <i class="${ChatSocialShare.escapeAttr(item.icon)}"></i>
            </div>
            <div class="popup-item-info">
              <span class="popup-item-name">${ChatSocialShare.escapeHTML(item.name)}</span>
              <span class="popup-item-sub">${ChatSocialShare.escapeHTML(item.actionText || "Click to contact")}</span>
            </div>
            <div class="popup-item-badge">
              <i class="fas fa-arrow-turn-down-left"></i>
            </div>
          </div>
        `;
      }).join("");

      this.popupEl.innerHTML = `
        <div class="chat-social-popup-header">
          <span><i class="fas fa-share-nodes"></i> Quick-Share Social Link</span>
          <span class="chat-social-popup-hint">↑↓ navigate · ↵ select</span>
        </div>
        <div class="chat-social-popup-list">
          ${itemsHTML}
        </div>
      `;

      // Delegate click on popup items
      const listEl = this.popupEl.querySelector(".chat-social-popup-list");
      listEl?.addEventListener("click", (e) => {
        const itemEl = e.target.closest(".chat-social-popup-item");
        if (!itemEl) return;
        const idx = parseInt(itemEl.dataset.index, 10);
        if (!isNaN(idx) && this.filteredItems[idx]) {
          this.selectPlatform(this.filteredItems[idx]);
        }
      });
    }

    updateActiveHighlight() {
      if (!this.popupEl) return;
      const items = this.popupEl.querySelectorAll(".chat-social-popup-item");
      items.forEach((el, idx) => {
        const isCurrent = idx === this.activeIndex;
        el.classList.toggle("active", isCurrent);
        if (isCurrent) {
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      });
    }

    openPopup() {
      if (!this.popupEl) return;
      this.popupEl.style.display = "block";
      this.popupEl.classList.add("visible");
      this.isOpen = true;
    }

    closePopup() {
      if (!this.popupEl) return;
      this.popupEl.style.display = "none";
      this.popupEl.classList.remove("visible");
      this.isOpen = false;
      this.activeMention = null;
    }

    /* ─── Select a Platform ─── */
    selectPlatform(platform) {
      if (!this.inputEl) return;

      // Clean up the "@query" portion from the input text
      const fullText = this.inputEl.value || "";
      if (this.activeMention && typeof this.activeMention.atIndex === "number") {
        const beforeAt = fullText.slice(0, this.activeMention.atIndex);
        const afterCursor = fullText.slice(this.inputEl.selectionStart || fullText.length);
        // Leave clean spacing if preceded by characters
        this.inputEl.value = beforeAt + (beforeAt.length && !beforeAt.endsWith(" ") ? " " : "") + afterCursor.trimStart();
      }

      this.attachedItem = { ...platform };
      this.closePopup();
      this.renderAttachment();

      // Keep focus on input for smooth typing
      this.inputEl.focus();
      this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));

      if (typeof this.onAttach === "function") {
        this.onAttach(this.attachedItem);
      }
    }

    /* ─── Render Composer Attachment Chip ─── */
    renderAttachment() {
      if (!this.attachmentEl) return;

      if (!this.attachedItem) {
        this.attachmentEl.style.display = "none";
        this.attachmentEl.innerHTML = "";
        return;
      }

      this.attachmentEl.style.display = "flex";
      this.attachmentEl.innerHTML = `
        <div class="chat-social-attachment-chip" style="--brand-color:${ChatSocialShare.escapeAttr(this.attachedItem.color)};">
          <div class="attachment-chip-icon">
            <i class="${ChatSocialShare.escapeAttr(this.attachedItem.icon)}"></i>
          </div>
          <div class="attachment-chip-content">
            <span class="attachment-chip-title">${ChatSocialShare.escapeHTML(this.attachedItem.name)}</span>
            <span class="attachment-chip-sub">${ChatSocialShare.escapeHTML(this.attachedItem.actionText || "Attached")}</span>
          </div>
          <button type="button" class="attachment-chip-close" id="removeSocialAttachmentBtn" title="Remove social link" aria-label="Remove">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;

      this.attachmentEl.querySelector("#removeSocialAttachmentBtn")?.addEventListener("click", () => {
        this.removeAttachment();
      });
    }

    removeAttachment() {
      this.attachedItem = null;
      this.renderAttachment();
      if (typeof this.onDetach === "function") {
        this.onDetach();
      }
      this.inputEl?.focus();
    }

    getAttachment() {
      return this.attachedItem;
    }

    clearAttachment() {
      this.attachedItem = null;
      this.renderAttachment();
    }

    /* ─── Static Clickable Card Renderer for Message Bubble ─── */
    static renderCardHTML(socialShare, isMine = false) {
      if (!socialShare || !socialShare.name) return "";

      const name = socialShare.name;
      const icon = socialShare.icon || "fas fa-link";
      const color = socialShare.color || "#f5a623";
      const url = socialShare.url || "#";
      const actionText = socialShare.actionText || "Click to contact us";

      return `
        <div class="msg-social-card-container">
          <a href="${ChatSocialShare.escapeAttr(url)}"
             target="_blank"
             rel="noopener noreferrer"
             class="msg-social-card ${isMine ? 'mine' : 'theirs'}"
             style="--social-brand:${ChatSocialShare.escapeAttr(color)};"
             title="Open ${ChatSocialShare.escapeAttr(name)}">
            <div class="msg-social-card-icon-wrap">
              <i class="${ChatSocialShare.escapeAttr(icon)}"></i>
            </div>
            <div class="msg-social-card-details">
              <div class="msg-social-card-name">${ChatSocialShare.escapeHTML(name)}</div>
              <div class="msg-social-card-action">
                <span>${ChatSocialShare.escapeHTML(actionText)}</span>
                <i class="fas fa-arrow-up-right-from-square"></i>
              </div>
            </div>
          </a>
        </div>
      `;
    }

    /* ─── Sanitisation Helpers ─── */
    static escapeHTML(str) {
      return String(str == null ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    static escapeAttr(str) {
      return String(str == null ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  }

  // Export to window
  window.ChatSocialShare = ChatSocialShare;
})(window);
