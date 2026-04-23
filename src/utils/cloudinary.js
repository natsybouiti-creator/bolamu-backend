const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function uploadToCloudinary(fileBuffer, folder, options = {}) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'auto', ...options },
            (error, result) => error ? reject(error) : resolve(result)
        );
        stream.end(fileBuffer);
    });
}

module.exports = { uploadToCloudinary, cloudinary };
