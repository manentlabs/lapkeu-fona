const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Folder dasar tempat semua upload disimpan: <project>/public/uploads
// __dirname di sini = .../koperasi-backend/src/middlewares
// naik 2 level -> .../koperasi-backend/public/uploads
const UPLOAD_BASE_DIR = path.join(__dirname, "..", "..", "public", "uploads");

/**
 * Factory untuk membuat instance multer upload berdasarkan subfolder.
 * Contoh: createUpload("anggota") -> simpan ke public/uploads/anggota
 *         createUpload("pengaturan") -> simpan ke public/uploads/pengaturan
 *
 * @param {string} subfolder - nama folder tujuan di dalam public/uploads
 * @param {object} options
 * @param {number} options.maxSizeMB - batas ukuran file (default 2MB)
 * @param {string[]} options.allowedMimeTypes - mime type yang diizinkan
 */
function createUpload(subfolder, options = {}) {
  const {
    maxSizeMB = 2,
    allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"],
  } = options;

  const destDir = path.join(UPLOAD_BASE_DIR, subfolder);

  // Pastikan folder tujuan ada, kalau belum, buat otomatis (termasuk nested)
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destDir);
    },
    filename: (req, file, cb) => {
      // Nama file unik: fieldname-timestamp-random.ext
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueName = `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, uniqueName);
    },
  });

  const fileFilter = (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error(`Tipe file tidak diizinkan. Gunakan: ${allowedMimeTypes.join(", ")}`));
    }
    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
  });
}

module.exports = createUpload;