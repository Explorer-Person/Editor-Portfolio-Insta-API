const { v2: cloudinary } = require('cloudinary');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload local file to Cloudinary
 * @param {string} localFilePath - path to image on disk
 * @param {string|null} publicId - optional public_id
 * @param {string} folder - cloudinary folder
 */
const uploadToCloudinary = async (localFilePath, options = {}, folder = 'blogs') => {
    try {
        const defaultOptions = {
            folder,
            use_filename: true,
            unique_filename: true,
            overwrite: false,
            resource_type: 'auto', // ⬅️ this is important
        };

        // Merge custom options
        const mergedOptions = { ...defaultOptions, ...options };

        const result = await cloudinary.uploader.upload(localFilePath, mergedOptions);
        return {
            url: result.secure_url,
            public_id: result.public_id,
            resource_type: result.resource_type,
        };
    } catch (err) {
        console.error('❌ Cloudinary Upload Error:', err.message);
        throw err;
    }
};

// ✅ Export both
module.exports = {
    cloudinary,
    uploadToCloudinary,
};
