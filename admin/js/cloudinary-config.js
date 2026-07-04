// =============================================
// CLOUDINARY CONFIG — HM Creative Admin Panel
// =============================================
const CLOUDINARY_CLOUD_NAME    = "diblwtdea";
const CLOUDINARY_UPLOAD_PRESET = "video_ads-hm-creative";
const CLOUDINARY_UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;
const CLOUDINARY_DELETE_URL    = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/delete_by_token`;

/**
 * Upload a file to Cloudinary with progress callback.
 * @param {File}     file        — The file to upload
 * @param {Function} onProgress  — (percent: number) => void
 * @returns {Promise<{secure_url, public_id, resource_type}>}
 */
function cloudinaryUpload(file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file",           file);
    formData.append("upload_preset",  CLOUDINARY_UPLOAD_PRESET);
    formData.append("cloud_name",     CLOUDINARY_CLOUD_NAME);

    // Detect resource type
    const isVideo = file.type.startsWith("video/");
    formData.append("resource_type", isVideo ? "video" : "image");

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress && onProgress(pct);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Invalid Cloudinary response"));
        }
      } else {
        let errMsg = "Upload failed";
        try {
          const body = JSON.parse(xhr.responseText);
          errMsg = body?.error?.message || errMsg;
        } catch { /* noop */ }
        reject(new Error(errMsg));
      }
    });

    xhr.addEventListener("error",  () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort",  () => reject(new Error("Upload aborted")));

    xhr.open("POST", CLOUDINARY_UPLOAD_URL);
    xhr.send(formData);
  });
}

/**
 * Returns a Cloudinary thumbnail URL for a given public_id.
 * Works for both images and videos (poster frame).
 */
function cloudinaryThumb(publicId, resourceType = "image") {
  const base = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}`;
  if (resourceType === "video") {
    return `${base}/video/upload/w_400,h_225,c_fill,so_2/${publicId}.jpg`;
  }
  return `${base}/image/upload/w_400,h_225,c_fill/${publicId}`;
}
