// ============================================================
// BOLAMU — Utilitaire Cloudinary (initialisation lazy)
// ============================================================

function getCloudinary() {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    return cloudinary;
}

async function uploadToCloudinary(fileBuffer, folder) {
    const cloudinary = getCloudinary();
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'auto' },
            (error, result) => error ? reject(error) : resolve(result)
        );
        stream.end(fileBuffer);
    });
}

module.exports = { uploadToCloudinary };