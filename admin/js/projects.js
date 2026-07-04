// =============================================
// projects.js — HM Creative Admin Panel
// CRUD for Firestore /projects + Cloudinary uploads
// =============================================

let editingProjectId = null;
let allProjects      = [];

/* ─── DOM refs ─── */
const projectsList  = document.getElementById("projectsList");
const projectForm   = document.getElementById("projectForm");
const formTitle     = document.getElementById("formTitle");
const mediaInput    = document.getElementById("mediaInput");
const uploadArea    = document.getElementById("uploadArea");
const progressWrap  = document.getElementById("progressWrap");
const progressBar   = document.getElementById("progressBar");
const progressLabel = document.getElementById("progressLabel");
const mediaPreview  = document.getElementById("mediaPreview");
const cancelEdit    = document.getElementById("cancelEdit");
const projectCount  = document.getElementById("projectCount");
const searchInput   = document.getElementById("searchProjects");
const filterCat     = document.getElementById("filterCategory");

let uploadedMedia = null; // { url, publicId, mediaType }

/* ─── Auth guard + init ─── */
adminAuthGuard(() => {
  loadProjects();
});

/* ─── Load all projects ─── */
async function loadProjects() {
  showTableSkeleton();
  try {
    const snap = await db.collection("projects")
      .orderBy("createdAt", "desc")
      .get();

    allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTable(allProjects);
  } catch (err) {
    console.error(err);
    showTableError("Failed to load projects.");
  }
}

/* ─── Render table ─── */
function renderTable(projects) {
  if (projectCount) projectCount.textContent = projects.length;

  if (!projects.length) {
    projectsList.innerHTML = `
      <tr><td colspan="6" class="table-empty">
        <i class="fas fa-folder-open"></i><br/>No projects yet. Add one!
      </td></tr>`;
    return;
  }

  projectsList.innerHTML = projects.map(p => {
    const thumb = p.mediaUrl
      ? `<img src="${p.mediaType === 'video' ? cloudinaryThumb(p.cloudinaryPublicId, 'video') : cloudinaryThumb(p.cloudinaryPublicId)}" class="project-thumb" alt="${p.title}" />`
      : `<div class="thumb-placeholder"><i class="fas fa-photo-film"></i></div>`;

    const date = p.createdAt?.toDate
      ? p.createdAt.toDate().toLocaleDateString()
      : "—";

    return `
      <tr data-id="${p.id}">
        <td>${thumb}</td>
        <td class="project-title-cell">${escHtml(p.title || "Untitled")}</td>
        <td><span class="cat-badge">${escHtml(p.category || "—")}</span></td>
        <td class="desc-cell">${escHtml((p.description || "").substring(0, 60))}${(p.description || "").length > 60 ? "…" : ""}</td>
        <td class="date-cell">${date}</td>
        <td class="actions-cell">
          <button class="action-btn edit-btn" onclick="startEdit('${p.id}')" title="Edit">
            <i class="fas fa-pen"></i>
          </button>
          <button class="action-btn delete-btn" onclick="deleteProject('${p.id}','${p.cloudinaryPublicId || ''}','${p.mediaType || ''}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
          ${p.mediaUrl ? `<a class="action-btn view-btn" href="${p.mediaUrl}" target="_blank" title="View media"><i class="fas fa-external-link-alt"></i></a>` : ""}
        </td>
      </tr>`;
  }).join("");
}

/* ─── Search / filter ─── */
function filterProjects() {
  const q   = (searchInput?.value || "").toLowerCase();
  const cat = filterCat?.value || "all";
  const filtered = allProjects.filter(p => {
    const matchQ   = !q || (p.title || "").toLowerCase().includes(q) ||
                          (p.description || "").toLowerCase().includes(q);
    const matchCat = cat === "all" || p.category === cat;
    return matchQ && matchCat;
  });
  renderTable(filtered);
}

searchInput?.addEventListener("input", filterProjects);
filterCat?.addEventListener("change", filterProjects);

/* ─── Drag & drop upload area ─── */
uploadArea?.addEventListener("dragover", e => { e.preventDefault(); uploadArea.classList.add("drag-over"); });
uploadArea?.addEventListener("dragleave", () => uploadArea.classList.remove("drag-over"));
uploadArea?.addEventListener("drop", e => {
  e.preventDefault();
  uploadArea.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFileUpload(file);
});
uploadArea?.addEventListener("click", () => mediaInput?.click());
mediaInput?.addEventListener("change", () => {
  if (mediaInput.files[0]) handleFileUpload(mediaInput.files[0]);
});

/* ─── Upload to Cloudinary ─── */
async function handleFileUpload(file) {
  // Validate
  const allowed = ["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","video/quicktime"];
  if (!allowed.includes(file.type)) {
    showToast("Unsupported file type. Use JPG, PNG, WebP, GIF, MP4, or WebM.", "error");
    return;
  }
  if (file.size > 100 * 1024 * 1024) {
    showToast("File too large. Max 100 MB.", "error");
    return;
  }

  progressWrap.style.display = "block";
  progressBar.style.width    = "0%";
  progressLabel.textContent  = "Uploading… 0%";
  uploadArea.style.pointerEvents = "none";

  try {
    const result = await cloudinaryUpload(file, (pct) => {
      progressBar.style.width   = pct + "%";
      progressLabel.textContent = `Uploading… ${pct}%`;
    });

    uploadedMedia = {
      url:        result.secure_url,
      publicId:   result.public_id,
      mediaType:  file.type.startsWith("video/") ? "video" : "image",
    };

    progressLabel.textContent = "Upload complete ✓";
    progressBar.style.background = "#4caf50";

    // Show preview
    showMediaPreview(uploadedMedia);
    showToast("Media uploaded successfully!", "success");
  } catch (err) {
    progressLabel.textContent = "Upload failed: " + err.message;
    progressBar.style.background = "#ff5252";
    showToast("Upload failed: " + err.message, "error");
  } finally {
    uploadArea.style.pointerEvents = "auto";
  }
}

function showMediaPreview(media) {
  if (!mediaPreview) return;
  if (media.mediaType === "video") {
    mediaPreview.innerHTML = `
      <div class="media-preview-wrap">
        <video src="${media.url}" controls muted class="preview-media"></video>
        <button type="button" class="remove-media-btn" onclick="clearMedia()">
          <i class="fas fa-times"></i>
        </button>
      </div>`;
  } else {
    mediaPreview.innerHTML = `
      <div class="media-preview-wrap">
        <img src="${media.url}" class="preview-media" alt="Preview" />
        <button type="button" class="remove-media-btn" onclick="clearMedia()">
          <i class="fas fa-times"></i>
        </button>
      </div>`;
  }
}

function clearMedia() {
  uploadedMedia = null;
  if (mediaPreview) mediaPreview.innerHTML = "";
  if (progressWrap) { progressWrap.style.display = "none"; progressBar.style.width = "0%"; progressBar.style.background = ""; }
  if (mediaInput)   mediaInput.value = "";
}

/* ─── Save project (add / edit) ─── */
projectForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("saveProjectBtn");

  const title       = document.getElementById("projTitle").value.trim();
  const description = document.getElementById("projDesc").value.trim();
  const category    = document.getElementById("projCategory").value;

  if (!title) { showToast("Project title is required.", "error"); return; }

  setLoading(btn, true);
  try {
    const data = {
      title,
      description,
      category,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (uploadedMedia) {
      data.mediaUrl            = uploadedMedia.url;
      data.mediaType           = uploadedMedia.mediaType;
      data.cloudinaryPublicId  = uploadedMedia.publicId;
    }

    if (editingProjectId) {
      await db.collection("projects").doc(editingProjectId).update(data);
      showToast("Project updated!", "success");
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("projects").add(data);
      showToast("Project added!", "success");
    }

    resetForm();
    loadProjects();
  } catch (err) {
    console.error(err);
    showToast("Failed to save project: " + err.message, "error");
  } finally {
    setLoading(btn, false);
  }
});

/* ─── Start editing ─── */
function startEdit(id) {
  const p = allProjects.find(x => x.id === id);
  if (!p) return;

  editingProjectId = id;
  formTitle.textContent = "Edit Project";
  cancelEdit.style.display = "inline-flex";

  document.getElementById("projTitle").value    = p.title || "";
  document.getElementById("projDesc").value     = p.description || "";
  document.getElementById("projCategory").value = p.category || "Video Ads";

  if (p.mediaUrl) {
    uploadedMedia = { url: p.mediaUrl, publicId: p.cloudinaryPublicId, mediaType: p.mediaType };
    showMediaPreview(uploadedMedia);
    if (progressWrap) progressWrap.style.display = "none";
  }

  // Scroll to form
  document.getElementById("projectForm")?.scrollIntoView({ behavior: "smooth" });
}

/* ─── Cancel edit ─── */
cancelEdit?.addEventListener("click", resetForm);

function resetForm() {
  editingProjectId = null;
  if (formTitle)   formTitle.textContent = "Add New Project";
  if (cancelEdit)  cancelEdit.style.display = "none";
  projectForm?.reset();
  clearMedia();
}

/* ─── Delete project ─── */
async function deleteProject(id, publicId, mediaType) {
  if (!confirm("Delete this project? This cannot be undone.")) return;
  try {
    await db.collection("projects").doc(id).delete();
    showToast("Project deleted.", "success");
    loadProjects();
  } catch (err) {
    showToast("Delete failed: " + err.message, "error");
  }
}

/* ─── Skeleton / error states ─── */
function showTableSkeleton() {
  if (!projectsList) return;
  projectsList.innerHTML = Array(4).fill(`
    <tr>
      ${Array(6).fill('<td><div class="skeleton" style="height:20px;border-radius:6px;"></div></td>').join("")}
    </tr>`).join("");
}

function showTableError(msg) {
  if (!projectsList) return;
  projectsList.innerHTML = `<tr><td colspan="6" class="table-empty error-state">
    <i class="fas fa-exclamation-circle"></i><br/>${msg}
  </td></tr>`;
}

/* ─── Helpers ─── */
function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
