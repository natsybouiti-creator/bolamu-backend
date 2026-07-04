// ============================================================
// BOLAMU — Middleware upload générique (posts/stories réseau social)
// ============================================================
const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Format non supporté. JPEG, PNG, WebP, MP4 uniquement.'), false);
    }
};

module.exports = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50 MB max (vidéos stories)
    }
});
