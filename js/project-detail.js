// =============================================
// project-detail.js — HM Creative Standalone Watch & Comments Page
// =============================================

let currentProjectId = "";
let currentProjectType = "video";
let currentProjectTitle = "";

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  currentProjectId   = params.get("id") || "";
  currentProjectType = params.get("type") || "video";

  if (!currentProjectId) {
    showErrorState("No project ID specified.");
    return;
  }

  loadProjectDetails();
  initAuthObserver();
});

// Load project data
async function loadProjectDetails() {
  const container = document.getElementById("mediaContainer");
  const pTitle    = document.getElementById("pTitle");
  const pCategory = document.getElementById("pCategory");
  const pTypeBadge= document.getElementById("pTypeBadge");
  const pDesc     = document.getElementById("pDesc");
  const pWebWrap  = document.getElementById("pWebLaunchWrap");
  const pWebBtn   = document.getElementById("pWebLaunchBtn");

  try {
    if (currentProjectType === "website") {
      // Fetch from RTDB websitePortfolio
      const snap = await rtdb.ref(`websitePortfolio/${currentProjectId}`).once("value");
      const item = snap.val();

      if (!item) {
        showErrorState("Website project not found.");
        return;
      }

      currentProjectTitle = item.title || "Website Project";
      pTitle.textContent = currentProjectTitle;
      pCategory.textContent = "Website Portfolio";
      pTypeBadge.textContent = "Interactive Web";
      pDesc.textContent = item.description || "";

      if (item.thumbnailUrl) {
        container.innerHTML = `<img src="${escapeHtml(item.thumbnailUrl)}" alt="${escapeHtml(item.title)}" />`;
      } else {
        container.innerHTML = `
          <div style="text-align:center;color:var(--gold);padding:3rem;">
            <i class="fas fa-globe" style="font-size:4rem;margin-bottom:1rem;"></i>
            <h3 style="color:var(--text);">${escapeHtml(item.title)}</h3>
          </div>`;
      }

      if (item.url) {
        pWebWrap.style.display = "block";
        pWebBtn.href = item.url;
      }

    } else {
      // Fetch Video project from Firestore /projects
      const doc = await db.collection("projects").doc(currentProjectId).get();
      if (!doc.exists) {
        showErrorState("Project not found.");
        return;
      }

      const item = doc.data();
      currentProjectTitle = item.title || "Video Project";
      pTitle.textContent = currentProjectTitle;
      pCategory.textContent = item.category || "Video Ad";
      pTypeBadge.textContent = "Video Project";
      pDesc.textContent = item.description || "";

      if (item.mediaUrl) {
        const isVideo = /\.(mp4|webm|ogg)$/i.test(item.mediaUrl);
        if (isVideo) {
          container.innerHTML = `<video src="${escapeHtml(item.mediaUrl)}" controls controlsList="nodownload" oncontextmenu="return false" playsinline preload="metadata" style="width:100%;max-height:580px;"></video>`;
        } else {
          container.innerHTML = `<img src="${escapeHtml(item.mediaUrl)}" alt="${escapeHtml(item.title)}" />`;
        }
      } else {
        container.innerHTML = `
          <div style="text-align:center;color:var(--text-dim);padding:3rem;">
            <i class="fas fa-photo-film" style="font-size:3rem;margin-bottom:0.5rem;"></i>
            <p>No preview media available</p>
          </div>`;
      }
    }

    // Load Comments for this item
    listenToComments(currentProjectId);

    // Init Like Button for this item
    initDetailLikeButton(currentProjectType, currentProjectId);

  } catch (err) {
    console.error("Error loading project details:", err);
    showErrorState("Failed to load project details: " + err.message);
  }
}

// Error state helper
function showErrorState(msg) {
  const container = document.getElementById("mediaContainer");
  if (container) {
    container.innerHTML = `
      <div style="text-align:center;padding:3rem 1rem;color:#ff5252;">
        <i class="fas fa-exclamation-triangle" style="font-size:2.5rem;margin-bottom:0.75rem;"></i>
        <p style="font-size:1.1rem;margin:0;">${escapeHtml(msg)}</p>
        <a href="index.html#portfolio" class="btn btn-ghost btn-sm" style="margin-top:1rem;display:inline-block;">Return to Portfolio</a>
      </div>`;
  }
}

// Realtime Comments Listener
function listenToComments(itemId) {
  const feed = document.getElementById("pCommentsFeed");
  const countBadge = document.getElementById("pCommentCount");

  rtdb.ref(`portfolioComments/${itemId}`).on("value", (snap) => {
    const data = snap.val() || {};
    const keys = Object.keys(data);

    countBadge.textContent = `(${keys.length})`;

    if (keys.length === 0) {
      feed.innerHTML = `<p style="color:var(--text-dim);font-size:0.9rem;text-align:center;padding:2rem;background:var(--surface2);border-radius:12px;">No comments yet. Be the first to leave a comment!</p>`;
      return;
    }

    const commentList = keys.map((key) => ({ commentId: key, ...data[key] }));
    commentList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    feed.innerHTML = commentList.map((c) => {
      const isLiked  = !!c.likedByAdmin;
      const hasReply = !!c.adminReply;
      const dateStr  = c.timestamp ? new Date(c.timestamp).toLocaleDateString() : "Just now";
      const avatar   = c.userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.userName || "U")}&background=f5a623&color=000&bold=true`;

      return `
        <div class="user-comment-card">
          <div class="user-comment-header">
            <div class="user-comment-user">
              <img src="${avatar}" alt="${escapeHtml(c.userName)}" class="user-comment-avatar" />
              <div>
                <div class="user-comment-name">${escapeHtml(c.userName || "User")}</div>
                <div class="user-comment-time">${dateStr}</div>
              </div>
            </div>
            ${isLiked ? `<span class="admin-liked-badge"><i class="fas fa-heart"></i> Liked by Hamza</span>` : ""}
          </div>

          <div class="user-comment-text">${escapeHtml(c.text)}</div>

          ${hasReply ? `
            <div class="user-admin-reply">
              <div class="user-admin-reply-header">
                <i class="fas fa-check-circle"></i> Hamza Mughal (Admin)
              </div>
              <div style="font-size:0.88rem;color:var(--text);">${escapeHtml(c.adminReply.text)}</div>
            </div>
          ` : ""}
        </div>`;
    }).join("");
  });
}

// Auth Observer for Comment Form & Navbar
function initAuthObserver() {
  auth.onAuthStateChanged((user) => {
    const wrap = document.getElementById("pCommentFormWrap");
    const navAuthArea = document.getElementById("navAuthArea");

    if (navAuthArea) {
      if (user) {
        const displayName = user.displayName || user.email.split("@")[0];
        const photoSrc = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=f5a623&color=000&bold=true`;
        navAuthArea.innerHTML = `
          <div class="nav-user">
            <img src="${photoSrc}" alt="${escapeHtml(displayName)}" />
            <span>${escapeHtml(displayName.split(" ")[0])}</span>
          </div>`;
      } else {
        navAuthArea.innerHTML = `
          <a href="login.html" class="btn btn-ghost" style="padding:0.45rem 1.1rem;font-size:0.82rem;">
            <i class="fas fa-sign-in-alt"></i> Login
          </a>`;
      }
    }

    if (!wrap) return;

    if (user) {
      const displayName = user.displayName || user.email.split("@")[0];
      wrap.innerHTML = `
        <form id="detailCommentForm" style="display:flex;gap:0.75rem;">
          <input type="text" id="detailCommentText" placeholder="Write a public comment as ${escapeHtml(displayName)}..." required style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:0.85rem 1rem;color:var(--text);outline:none;font-size:0.92rem;" />
          <button type="submit" class="btn btn-gold btn-sm" id="detailCommentBtn">
            <i class="fas fa-paper-plane"></i> Post Comment
          </button>
        </form>`;

      document.getElementById("detailCommentForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("detailCommentText");
        const btn   = document.getElementById("detailCommentBtn");
        const text  = input.value.trim();

        if (!text) return;
        setLoading(btn, true);

        try {
          const commentData = {
            userId: user.uid,
            userName: displayName,
            userPhoto: user.photoURL || "",
            text,
            itemTitle: currentProjectTitle,
            itemType: currentProjectType,
            timestamp: firebase.database.ServerValue.TIMESTAMP
          };

          await rtdb.ref(`portfolioComments/${currentProjectId}`).push(commentData);
          input.value = "";
          showToast("Comment posted!", "success");
        } catch (err) {
          showToast("Failed to post comment: " + err.message, "error");
        } finally {
          setLoading(btn, false);
        }
      });

    } else {
      wrap.innerHTML = `
        <div style="background:var(--surface2);padding:1.25rem;border-radius:var(--radius);text-align:center;font-size:0.9rem;color:var(--text-muted);border:1px solid var(--border);">
          <i class="fas fa-user-lock" style="color:var(--gold);font-size:1.5rem;margin-bottom:0.5rem;display:block;"></i>
          <span>Want to leave a comment on this project?</span>
          <div style="margin-top:0.75rem;">
            <a href="login.html" onclick="sessionStorage.setItem('redirectAfterLogin', window.location.href)" class="btn btn-gold btn-sm" style="display:inline-flex;align-items:center;gap:0.5rem;text-decoration:none;">
              <i class="fas fa-sign-in-alt"></i> Sign In to Comment
            </a>
          </div>
        </div>`;
    }
  });
}

// Like Button initialization for detail page
function initDetailLikeButton(type, id) {
  const btn = document.getElementById("pDetailLikeBtn");
  const countEl = document.getElementById("pDetailLikeCount");
  if (!btn || !id) return;

  rtdb.ref(`likes/${type}/${id}`).on("value", (snap) => {
    const val = snap.val() || {};
    if (countEl) countEl.textContent = val.count || 0;
    const user = auth.currentUser;
    if (user && val.users && val.users[user.uid]) {
      btn.classList.add("liked");
    } else {
      btn.classList.remove("liked");
    }
  });

  btn.onclick = () => {
    const user = auth.currentUser;
    if (!user) {
      showToast("Please sign in to like this project!", "error");
      sessionStorage.setItem("redirectAfterLogin", window.location.href);
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1200);
      return;
    }

    const userUid = user.uid;
    const itemLikesRef = rtdb.ref(`likes/${type}/${id}`);

    itemLikesRef.transaction((currentData) => {
      if (!currentData) {
        currentData = { count: 1, users: {} };
        currentData.users[userUid] = true;
        return currentData;
      }
      if (!currentData.users) currentData.users = {};

      if (currentData.users[userUid]) {
        delete currentData.users[userUid];
        currentData.count = Math.max(0, (currentData.count || 1) - 1);
      } else {
        currentData.users[userUid] = true;
        currentData.count = (currentData.count || 0) + 1;
      }
      return currentData;
    });
  };
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function setLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.style.opacity = isLoading ? "0.6" : "1";
}
