// =============================================
// chats.js — HM Creative Admin Panel
// Real-time split-view chat manager
// Path: /chats/{userId}/messages/{msgId}
// =============================================

let selectedUserId   = null;
let selectedUserName = null;
let activeRef        = null;   // Firebase ref currently being listened to
let adminUser        = null;

/* ─── DOM refs ─── */
const userList    = document.getElementById("chatUserList");
const chatPanel   = document.getElementById("chatPanel");
const chatEmpty   = document.getElementById("chatEmpty");
const messagesEl  = document.getElementById("chatMessages");
const chatInput   = document.getElementById("chatInput");
const sendBtn     = document.getElementById("sendBtn");
const chatTitle   = document.getElementById("chatTitle");
const chatSubt    = document.getElementById("chatSubtitle");
const totalBadge  = document.getElementById("totalUnread");
const charCount   = document.getElementById("charCount");

/* ─── Auth guard + init ─── */
adminAuthGuard((user) => {
  adminUser = user;
  listenAllChats();
});

/* ─── Listen to all chats top-level ─── */
function listenAllChats() {
  rtdb.ref("chats").on("value", async (snap) => {
    const data    = snap.val() || {};
    const userIds = Object.keys(data);

    // Fetch user names from Firestore
    const userEntries = await Promise.all(
      userIds.map(async (uid) => {
        let name  = data[uid]?.name || "Unknown User";
        let email = data[uid]?.email || "";
        try {
          const userSnap = await db.collection("users").doc(uid).get();
          if (userSnap.exists) {
            name  = userSnap.data().name  || name;
            email = userSnap.data().email || email;
          }
        } catch { /* noop */ }

        const messages = data[uid]?.messages || {};
        const msgs = Object.values(messages);

        const unread = msgs.filter(m => !m.isRead && m.senderId !== adminUser.uid).length;
        const lastMsg = msgs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];

        return { uid, name, email, unread, lastMsg, msgCount: msgs.length };
      })
    );

    // Sort by latest message
    userEntries.sort((a, b) => {
      const ta = a.lastMsg?.timestamp || 0;
      const tb = b.lastMsg?.timestamp || 0;
      return tb - ta;
    });

    renderUserList(userEntries);

    // Total unread badge
    const totalUnread = userEntries.reduce((sum, u) => sum + u.unread, 0);
    if (totalBadge) {
      totalBadge.textContent = totalUnread > 0 ? totalUnread : "";
      totalBadge.style.display = totalUnread > 0 ? "flex" : "none";
    }

    if (selectedUserId) highlightUser(selectedUserId);
  });
}

/* ─── Render user list ─── */
function renderUserList(users) {
  if (!userList) return;

  if (!users.length) {
    userList.innerHTML = `<div class="chat-list-empty"><i class="fas fa-inbox"></i><p>No chats yet</p></div>`;
    return;
  }

  userList.innerHTML = users.map(u => {
    const time = u.lastMsg?.timestamp ? formatChatTime(u.lastMsg.timestamp) : "";
    const preview = u.lastMsg?.text
      ? u.lastMsg.text.substring(0, 40) + (u.lastMsg.text.length > 40 ? "…" : "")
      : "No messages";
    const unreadBadge = u.unread > 0 ? `<span class="unread-badge">${u.unread}</span>` : "";
    const isActive    = u.uid === selectedUserId ? "active" : "";
    const initials    = (u.name || "U").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

    return `
      <div class="chat-user-item ${isActive}" data-uid="${escAttr(u.uid)}" data-name="${escAttr(u.name)}" data-email="${escAttr(u.email)}">
        <div class="chat-user-avatar">${initials}</div>
        <div class="chat-user-meta">
          <div class="chat-user-top">
            <span class="chat-user-name">${escHtml(u.name)}</span>
            <span class="chat-user-time">${time}</span>
          </div>
          <div class="chat-user-preview">${escHtml(preview)}</div>
        </div>
        ${unreadBadge}
      </div>`;
  }).join("");
}

/* ─── Delegated click on user list ─── */
userList?.addEventListener("click", (e) => {
  const item = e.target.closest(".chat-user-item");
  if (item) openChat(item.dataset.uid, item.dataset.name, item.dataset.email);
});

/* ─── Open a chat thread ─── */
function openChat(uid, name, email) {
  if (!uid) return;

  selectedUserId   = uid;
  selectedUserName = name;

  if (chatEmpty) chatEmpty.style.display = "none";
  if (chatPanel) chatPanel.style.display = "flex";
  if (chatTitle) chatTitle.textContent   = name;
  if (chatSubt)  chatSubt.textContent    = email || "";

  highlightUser(uid);

  // Detach previous listeners
  if (activeRef) {
    activeRef.off();
    activeRef = null;
  }

  cancelReply();
  markAllRead(uid);
  listenMessages(uid);
}

function highlightUser(uid) {
  document.querySelectorAll(".chat-user-item").forEach(el => {
    el.classList.toggle("active", el.dataset.uid === uid);
  });
}

/* ─── Reply state ─── */
let replyingToMsg = null;

/* ─── Message cache for reply lookups ─── */
const msgCache = {};

/* ─── Listen to thread messages ─── */
// Uses child_added + child_changed instead of value
// to avoid full re-render on every change (which could drop messages)
function listenMessages(uid) {
  if (!messagesEl) return;

  // Clear previous messages and show skeleton
  messagesEl.innerHTML = "";
  showMsgSkeleton();

  const msgsRef = rtdb.ref(`chats/${uid}/messages`).orderByChild("timestamp");
  activeRef = rtdb.ref(`chats/${uid}/messages`); // unordered ref for .off()

  // First fetch to hide skeleton and show empty state if no messages
  activeRef.once("value", (snap) => {
    hideSkeleton();
    if (!snap.exists()) {
      messagesEl.innerHTML = `<div class="msg-empty"><i class="fas fa-comment-slash"></i><p>No messages yet</p></div>`;
    }
  });

  // Timestamp at which we start listening — used to detect "new" vs. "existing" messages
  const listenStart = Date.now();

  // ── child_added: fires for each existing message on attach, then for each new one ──
  msgsRef.on("child_added", (snap) => {
    // Remove empty state element if it exists
    messagesEl.querySelector(".msg-empty")?.remove();
    hideSkeleton();

    const msg = { id: snap.key, ...snap.val() };

    // Skip if already rendered (safety guard)
    if (document.getElementById(`msg-${msg.id}`)) return;

    msgCache[msg.id] = msg;

    // Play sound only for NEW incoming messages (not initial load replay)
    const ts = typeof msg.timestamp === "number" ? msg.timestamp : 0;
    if (ts > listenStart && msg.senderId !== adminUser?.uid) {
      playNotificationSound();
    }

    const el = buildMsgEl(msg);
    messagesEl.appendChild(el);
    scrollBottom();
  }, (err) => {
    console.error("[Admin] child_added error:", err);
  });

  // ── child_changed: fires when a message field changes (e.g. isRead) ──
  msgsRef.on("child_changed", (snap) => {
    const msg = { id: snap.key, ...snap.val() };
    msgCache[msg.id] = msg;

    const existing = document.getElementById(`msg-${msg.id}`);
    if (existing) {
      existing.replaceWith(buildMsgEl(msg));
    }
  }, (err) => {
    console.error("[Admin] child_changed error:", err);
  });
}

/* ─── Build a message DOM element (does NOT append) ─── */
function buildMsgEl(msg) {
  const isAdmin = msg.senderId === adminUser?.uid || msg.senderId === "ADMIN";
  const time    = (typeof msg.timestamp === "number")
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const div = document.createElement("div");
  div.className = `msg-wrap ${isAdmin ? "admin-msg" : "user-msg"}`;
  div.id        = `msg-${msg.id}`;

  let quoteHTML = "";
  if (msg.replyTo) {
    quoteHTML = `
      <div class="msg-reply-quote" data-target="${escAttr(msg.replyTo.messageId || "")}">
        <span class="msg-reply-quote-sender">${escHtml(msg.replyTo.senderName)}</span>
        <span class="msg-reply-quote-text">${escHtml(msg.replyTo.text)}</span>
      </div>`;
  }

  const replyBtn = `<button class="msg-reply-btn" data-msg-id="${escAttr(msg.id)}" title="Reply"><i class="fas fa-reply"></i></button>`;

  div.innerHTML = `
    <div class="msg-bubble-container" style="position:relative;display:flex;align-items:center;gap:0.5rem;width:100%;justify-content:${isAdmin ? "flex-end" : "flex-start"}">
      ${!isAdmin ? replyBtn : ""}
      <div class="msg-bubble">
        <span class="msg-sender">${isAdmin ? "You" : escHtml(msg.senderName || "User")}</span>
        ${quoteHTML}
        <span class="msg-text">${escHtml(msg.text || "")}</span>
        <span class="msg-meta">
          <span class="msg-time">${time}</span>
          ${isAdmin ? `<i class="fas fa-check${msg.isRead ? "-double read" : ""} msg-tick"></i>` : ""}
        </span>
      </div>
      ${isAdmin ? replyBtn : ""}
    </div>`;

  return div;
}

/* ─── Delegated clicks inside the message list ─── */
messagesEl?.addEventListener("click", (e) => {
  const replyBtn = e.target.closest(".msg-reply-btn");
  if (replyBtn) {
    const m = msgCache[replyBtn.dataset.msgId];
    if (m) startReply(m.id, m.senderName || "User", m.text || "");
    return;
  }
  const quoteBlock = e.target.closest(".msg-reply-quote");
  if (quoteBlock) scrollToMessage(quoteBlock.dataset.target);
});

/* ─── Reply management ─── */
function startReply(messageId, senderName, text) {
  replyingToMsg = { messageId, senderName, text };
  const preview  = document.getElementById("replyPreview");
  const senderEl = document.getElementById("replySender");
  const textEl   = document.getElementById("replyText");
  if (senderEl) senderEl.textContent = `Replying to ${senderName}`;
  if (textEl)   textEl.textContent   = text;
  if (preview)  preview.classList.add("visible");
  chatInput?.focus();
}

function cancelReply() {
  replyingToMsg = null;
  const preview = document.getElementById("replyPreview");
  if (preview) preview.classList.remove("visible");
}

document.getElementById("cancelReplyBtn")?.addEventListener("click", cancelReply);

function scrollToMessage(msgId) {
  const el = document.getElementById(`msg-${msgId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("highlighted");
  el.style.transform = "scale(1.05)";
  setTimeout(() => { el.style.transform = ""; el.classList.remove("highlighted"); }, 1500);
}

/* ─── Send admin reply ─── */
async function sendAdminReply() {
  if (!selectedUserId || !adminUser) return;
  const text = chatInput?.value?.trim();
  if (!text) return;

  chatInput.value = "";
  updateCharCount();

  const msg = {
    text,
    senderId:   adminUser.uid,
    senderName: adminUser.displayName || "Admin",
    timestamp:  firebase.database.ServerValue.TIMESTAMP,
    isRead:     false,
  };

  if (replyingToMsg) {
    msg.replyTo = replyingToMsg;
    cancelReply();
  }

  try {
    await rtdb.ref(`chats/${selectedUserId}/messages`).push(msg);
  } catch (err) {
    showToast("Failed to send: " + err.message, "error");
  }
}

sendBtn?.addEventListener("click", sendAdminReply);
chatInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAdminReply(); }
});
chatInput?.addEventListener("input", updateCharCount);

function updateCharCount() {
  if (charCount) charCount.textContent = `${chatInput?.value?.length || 0}/500`;
}

/* ─── Mark messages as read ─── */
async function markAllRead(uid) {
  try {
    const snap = await rtdb.ref(`chats/${uid}/messages`).once("value");
    if (!snap.exists()) return;
    const updates = {};
    snap.forEach(child => {
      if (!child.val().isRead && child.val().senderId !== adminUser?.uid) {
        updates[`chats/${uid}/messages/${child.key}/isRead`] = true;
      }
    });
    if (Object.keys(updates).length) await rtdb.ref().update(updates);
  } catch { /* noop */ }
}

/* ─── Search users ─── */
const userSearch = document.getElementById("userSearch");
userSearch?.addEventListener("input", () => {
  const q = userSearch.value.toLowerCase();
  document.querySelectorAll(".chat-user-item").forEach(el => {
    const name = el.querySelector(".chat-user-name")?.textContent?.toLowerCase() || "";
    el.style.display = name.includes(q) ? "" : "none";
  });
});

/* ─── Helpers ─── */
function scrollBottom() {
  if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showMsgSkeleton() {
  if (!messagesEl) return;
  messagesEl.innerHTML = Array(4).fill(0).map((_, i) =>
    `<div class="msg-wrap ${i % 2 === 0 ? "user-msg" : "admin-msg"}">
      <div class="skeleton" style="height:52px;width:${45 + Math.random() * 25}%;border-radius:16px;"></div>
    </div>`
  ).join("");
}

function hideSkeleton() {
  messagesEl?.querySelector(".skeleton-wrap")?.remove();
  // Also remove individual skeleton items
  messagesEl?.querySelectorAll(".skeleton")?.forEach(el => el.closest(".msg-wrap")?.remove());
}

function formatChatTime(ts) {
  const d   = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000)    return "just now";
  if (diff < 3600000)  return Math.floor(diff / 60000) + "m";
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** escHtml — safe for innerHTML. Converts \n to <br>. */
function escHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");
}

/** escAttr — safe for data-* attribute values. Uses &#10; for newlines. */
function escAttr(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "&#10;");
}
