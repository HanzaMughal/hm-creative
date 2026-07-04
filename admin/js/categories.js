// =============================================
// categories.js — HM Creative Admin Panel
// CRUD for Firestore /categories collection
// =============================================

let allCategories = [];
let editingCatId  = null;

/* ─── DOM refs ─── */
const catList     = document.getElementById("catList");
const catForm     = document.getElementById("catForm");
const catFormTitle= document.getElementById("catFormTitle");
const catNameIn   = document.getElementById("catName");
const catDescIn   = document.getElementById("catDesc");
const cancelBtn   = document.getElementById("cancelCatEdit");
const catCount    = document.getElementById("catCount");

/* ─── Auth guard ─── */
adminAuthGuard(() => {
  loadCategories();
});

/* ─── Load categories ─── */
async function loadCategories() {
  showSkeleton();
  try {
    const snap = await db.collection("categories").orderBy("order", "asc").get();
    allCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList();
  } catch (err) {
    console.error(err);
    catList.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load categories.</p></div>`;
  }
}

/* ─── Render list ─── */
function renderList() {
  if (catCount) catCount.textContent = allCategories.length;

  if (!allCategories.length) {
    catList.innerHTML = `<div class="empty-state"><i class="fas fa-layer-group"></i><p>No categories yet. Add your first one!</p></div>`;
    return;
  }

  catList.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Category Name</th>
          <th>Description</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${allCategories.map((cat, i) => `
          <tr>
            <td style="color:var(--text-dim);font-size:0.8rem;">${cat.order ?? i + 1}</td>
            <td><strong>${escHtml(cat.name)}</strong></td>
            <td style="color:var(--text-muted);font-size:0.83rem;">${escHtml(cat.description || '—')}</td>
            <td>
              <div class="actions-cell">
                <button class="action-btn edit-btn" onclick="startEdit('${cat.id}')" title="Edit">
                  <i class="fas fa-pen"></i>
                </button>
                <button class="action-btn delete-btn" onclick="deleteCat('${cat.id}','${escHtml(cat.name)}')" title="Delete">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

/* ─── Save category ─── */
catForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn  = document.getElementById("saveCatBtn");
  const name = catNameIn?.value?.trim();
  const desc = catDescIn?.value?.trim();

  if (!name) { showToast("Category name is required.", "error"); return; }

  setLoading(btn, true);
  try {
    if (editingCatId) {
      await db.collection("categories").doc(editingCatId).update({
        name, description: desc,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      showToast("Category updated!", "success");
    } else {
      const maxOrder = allCategories.reduce((m, c) => Math.max(m, c.order ?? 0), 0);
      await db.collection("categories").add({
        name, description: desc,
        order:     maxOrder + 1,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      showToast("Category added!", "success");
    }
    resetForm();
    loadCategories();
  } catch (err) {
    showToast("Save failed: " + err.message, "error");
  } finally {
    setLoading(btn, false);
  }
});

/* ─── Start edit ─── */
function startEdit(id) {
  const cat = allCategories.find(c => c.id === id);
  if (!cat) return;

  editingCatId = id;
  if (catFormTitle) catFormTitle.textContent = "Edit Category";
  if (cancelBtn)    cancelBtn.style.display  = "inline-flex";
  if (catNameIn)    catNameIn.value          = cat.name;
  if (catDescIn)    catDescIn.value          = cat.description || "";

  catForm?.scrollIntoView({ behavior: "smooth" });
}

cancelBtn?.addEventListener("click", resetForm);

function resetForm() {
  editingCatId = null;
  if (catFormTitle) catFormTitle.textContent = "Add New Category";
  if (cancelBtn)    cancelBtn.style.display  = "none";
  catForm?.reset();
}

/* ─── Delete category ─── */
async function deleteCat(id, name) {
  if (!confirm(`Delete category "${name}"? This cannot be undone.`)) return;
  try {
    await db.collection("categories").doc(id).delete();
    showToast("Category deleted.", "success");
    loadCategories();
  } catch (err) {
    showToast("Delete failed: " + err.message, "error");
  }
}

/* ─── Skeleton ─── */
function showSkeleton() {
  if (!catList) return;
  catList.innerHTML = Array(3).fill(
    `<div class="skeleton" style="height:48px;border-radius:10px;margin-bottom:0.6rem;"></div>`
  ).join("");
}

/* ─── Helpers ─── */
function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
