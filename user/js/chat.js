// =============================================
// chat.js — HM Creative Real-time Chat
// Path: /chats/{userId}/messages/{messageId}
// =============================================

let currentUser = null;
let activeRef   = null;   // Firebase ref currently being listened to

/* ── DOM refs ── */
const chatMessages  = document.getElementById("chatMessages");
const chatInput     = document.getElementById("chatInput");
const sendBtn       = document.getElementById("sendBtn");
const userNameEl    = document.getElementById("chatUserName");
const userAvatarEl  = document.getElementById("chatUserAvatar");
const charCount     = document.getElementById("charCount");

/* ── Auth guard ── */
auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  // Guard against multiple auth fires (e.g. token refresh)
  if (currentUser?.uid === user.uid) return;
  currentUser = user;
  initChat();
});

let userDisplayName = "User";

/* ── Init ── */
async function initChat() {
  userDisplayName = currentUser.displayName || "User";
  try {
    const userSnap = await db.collection("users").doc(currentUser.uid).get();
    if (userSnap.exists && userSnap.data().name) {
      userDisplayName = userSnap.data().name;
    }
  } catch (e) {
    console.warn("Could not fetch user name from Firestore:", e);
  }

  if (userNameEl) userNameEl.textContent = userDisplayName;
  if (userAvatarEl) {
    userAvatarEl.src = currentUser.photoURL
      ? currentUser.photoURL
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=f5a623&color=000&bold=true`;
  }

  // Detach any previous listener before re-initialising
  if (activeRef) { activeRef.off(); activeRef = null; }

  activeRef = rtdb.ref(`chats/${currentUser.uid}/messages`);

  // Write name and email to RTDB for the admin panel's real-time chats list
  try {
    await rtdb.ref(`chats/${currentUser.uid}`).update({
      name: userDisplayName,
      email: currentUser.email || ""
    });
  } catch (err) {
    console.warn("Could not write user metadata to RTDB:", err);
  }

  listenMessages();
}

/* ── Reply state ── */
let replyingToMsg = null;

/* ── Message cache for reply lookups ── */
const msgCache = {};

/* ── Listen for messages ── */
// Uses child_added + child_changed instead of on("value")
// to append messages individually — no full DOM wipe on each update.
function listenMessages() {
  if (!chatMessages || !activeRef) return;

  chatMessages.innerHTML = "";
  showSkeleton();

  const msgsRef   = activeRef.orderByChild("timestamp");

  // First fetch to hide skeleton and show empty state if no messages
  activeRef.once("value", (snap) => {
    hideSkeleton();
    if (!snap.exists()) {
      chatMessages.innerHTML = `
        <div class="chat-empty">
          <i class="fas fa-comments"></i>
          <p>No messages yet. Say hi to Hamza! 👋</p>
        </div>`;
    }
  });

  const listenStart = Date.now();

  // ── child_added fires for each existing message + each new one ──
  msgsRef.on("child_added", (snap) => {
    // Remove empty state element if it exists
    chatMessages.querySelector(".chat-empty")?.remove();
    hideSkeleton();

    const msg = { id: snap.key, ...snap.val() };

    // Skip if already rendered (safety guard)
    if (document.getElementById(`msg-${msg.id}`)) return;

    msgCache[msg.id] = msg;

    // Play sound only for new messages from admin (not initial replay)
    const ts = typeof msg.timestamp === "number" ? msg.timestamp : 0;
    if (ts > listenStart && msg.senderId !== currentUser.uid) {
      playNotificationSound();
    }

    const el = buildMsgEl(msg);
    chatMessages.appendChild(el);
    scrollBottom();
  }, (err) => {
    console.error("[Chat] child_added error:", err);
    hideSkeleton();
  });

  // ── child_changed fires when a field changes (e.g. isRead after admin reply) ──
  msgsRef.on("child_changed", (snap) => {
    const msg = { id: snap.key, ...snap.val() };
    msgCache[msg.id] = msg;
    const existing = document.getElementById(`msg-${msg.id}`);
    if (existing) existing.replaceWith(buildMsgEl(msg));
  }, (err) => {
    console.error("[Chat] child_changed error:", err);
  });
}

/* ── Build a single message element (does NOT append to DOM) ── */
function buildMsgEl(msg) {
  const isMine = msg.senderId === currentUser?.uid;
  const time   = (typeof msg.timestamp === "number")
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const div = document.createElement("div");
  div.className = `msg-wrap ${isMine ? "mine" : "theirs"}`;
  div.id        = `msg-${msg.id}`;

  let quoteHTML = "";
  if (msg.replyTo) {
    quoteHTML = `
      <div class="msg-reply-quote" data-target="${escapeAttr(msg.replyTo.messageId || "")}">
        <span class="msg-reply-quote-sender">${escapeHTML(msg.replyTo.senderName)}</span>
        <span class="msg-reply-quote-text">${escapeHTML(msg.replyTo.text)}</span>
      </div>`;
  }

  const replyBtn = `<button class="msg-reply-btn" data-msg-id="${escapeAttr(msg.id)}" title="Reply"><i class="fas fa-reply"></i></button>`;

  div.innerHTML = `
    <div class="msg-bubble-container" style="position:relative;display:flex;align-items:center;gap:0.5rem;width:100%;justify-content:${isMine ? "flex-end" : "flex-start"}">
      ${!isMine ? replyBtn : ""}
      <div class="msg-bubble">
        ${quoteHTML}
        <span class="msg-text">${escapeHTML(msg.text || "")}</span>
        <span class="msg-meta">
          <span class="msg-time">${time}</span>
          ${isMine ? `<i class="fas fa-check${msg.isRead ? "-double read" : ""} msg-tick"></i>` : ""}
        </span>
      </div>
      ${isMine ? replyBtn : ""}
    </div>`;

  return div;
}

/* ── Delegated click handler for reply buttons and quote blocks ── */
chatMessages?.addEventListener("click", (e) => {
  const replyBtn = e.target.closest(".msg-reply-btn");
  if (replyBtn) {
    const m = msgCache[replyBtn.dataset.msgId];
    if (m) startReply(m.id, m.senderName || "Admin", m.text || "");
    return;
  }
  const quoteBlock = e.target.closest(".msg-reply-quote");
  if (quoteBlock) scrollToMessage(quoteBlock.dataset.target);
});

/* ── Reply management ── */
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

/* ── Send message ── */
async function sendMessage() {
  const text = chatInput?.value?.trim();
  if (!text || !currentUser) return;

  chatInput.value = "";
  updateCharCount();

  const msgData = {
    text,
    senderId:   currentUser.uid,
    senderName: userDisplayName,
    timestamp:  firebase.database.ServerValue.TIMESTAMP,
    isRead:     false,
  };

  if (replyingToMsg) {
    msgData.replyTo = replyingToMsg;
    cancelReply();
  }

  try {
    await activeRef.push(msgData);
  } catch (err) {
    console.error("Send failed:", err);
    showSendError();
  }
}

sendBtn?.addEventListener("click", sendMessage);

chatInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

chatInput?.addEventListener("input", updateCharCount);

function updateCharCount() {
  if (!charCount || !chatInput) return;
  charCount.textContent = `${chatInput.value.length}/500`;
  chatInput.maxLength = 500;
}

/* ── Logout ── */
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  if (activeRef) { activeRef.off(); activeRef = null; }
  await auth.signOut();
  window.location.href = "index.html";
});

/* ── Helpers ── */
function scrollBottom() {
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
}

/** escapeHTML — safe for innerHTML. Converts \n to <br>. */
function escapeHTML(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");
}

/** escapeAttr — safe for data-* attribute values. Uses &#10; for newlines. */
function escapeAttr(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "&#10;");
}

function showSkeleton() {
  if (!chatMessages) return;
  chatMessages.innerHTML = `
    <div class="skeleton-wrap">
      ${Array(4).fill('<div class="skeleton-msg"></div>').join("")}
    </div>`;
}

function hideSkeleton() {
  chatMessages?.querySelector(".skeleton-wrap")?.remove();
}

function showSendError() {
  if (!chatMessages) return;
  const err = document.createElement("div");
  err.className = "send-error";
  err.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Failed to send. Try again.';
  chatMessages.appendChild(err);
  scrollBottom();
  setTimeout(() => err.remove(), 3000);
}
