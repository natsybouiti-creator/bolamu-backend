const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer : stockage en mémoire, limite 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez JPG, PNG ou WEBP.'), false);
    }
  },
});

// Middleware d'upload vers Cloudinary
async function uploadEvent(req, res, next) {
  if (!req.file) {
    // Pas de fichier → continuer sans erreur (photo optionnelle)
    return next();
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'bolamu/events',
          transformation: [
            { width: 1200, height: 630, crop: 'fill', quality: 'auto:good' }
          ],
          resource_type: 'image',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    req.cloudinaryUrl = result.secure_url;
    next();
  } catch (error) {
    console.error('[uploadEvent]', error.message);
    return res.status(500).json({ success: false, message: 'Erreur upload image : ' + error.message });
  }
}

module.exports = { upload, uploadEvent };
