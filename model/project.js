// model/project.js
const db = require('../db/db');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const uploadsDir = path.join(__dirname, '../public/upload/project');

const Project = {
    init: async () => {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS projects (
                id BIGINT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                mainImage VARCHAR(255),
                imageFiles TEXT,
                videoFiles TEXT,
                hashtags TEXT,
                githubLink VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table "projects" is ready.');
    },

    create: async ({ id, title, description, mainImage, imageFiles, videoFiles, hashtags, githubLink }) => {
        if (id === 0) throw new Error('ID cannot be zero');
        console.log('Creating project with data in DB:', { id, title, description, mainImage, imageFiles, videoFiles, hashtags, githubLink });
        await db.execute(
            `INSERT INTO projects 
            (id, title, description, mainImage, imageFiles, videoFiles, hashtags, githubLink)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                title,
                description,
                mainImage,
                imageFiles,
                videoFiles,
                hashtags,
                githubLink
            ]
        );
        return id;
    },

    findAll: async () => {
        const [rows] = await db.execute(`SELECT * FROM projects ORDER BY created_at DESC`);
        return rows;
    },

    findById: async (id) => {
        const [rows] = await db.execute(`SELECT * FROM projects WHERE id = ? LIMIT 1`, [id]);
        return rows[0];
    },

    updateById: async (
        id,
        {
            title,
            description,
            mainImage,
            imageFiles,
            videoFiles,
            hashtags,
            githubLink
        }
    ) => {
        const parsedId = parseInt(id);
        const existing = await Project.findById(parsedId);
        if (!existing) throw new Error(`Project with ID ${parsedId} not found`);

        // 🧠 Extract Cloudinary public_id from a full URL
        const extractPublicId = (cloudinaryUrl) => {
            if (typeof cloudinaryUrl !== 'string') return null;
            const match = cloudinaryUrl.match(/\/upload\/(?:v\d+\/)?([^\.]+)(?:\.\w+)?$/);
            return match ? match[1] : null;
        };

        // 🧾 Parse old values from DB
        const oldImages = JSON.parse(existing.imageFiles || '[]');
        const oldVideos = JSON.parse(existing.videoFiles || '[]');
        const oldMainImage = existing.mainImage;

        // 🆕 Parse new values from update payload
        const newImages = Array.isArray(imageFiles) ? imageFiles : JSON.parse(imageFiles || '[]');
        const newVideos = Array.isArray(videoFiles) ? videoFiles : JSON.parse(videoFiles || '[]');
        const newMainImage = mainImage;

        // 🆔 Extract public IDs
        const oldImageIds = oldImages.map(extractPublicId).filter(Boolean);
        const newImageIds = newImages.map(extractPublicId).filter(Boolean);
        const oldVideoIds = oldVideos.map(extractPublicId).filter(Boolean);
        const newVideoIds = newVideos.map(extractPublicId).filter(Boolean);

        // 🧹 Delete removed images from Cloudinary
        const imageIdsToDelete = oldImageIds.filter(id => !newImageIds.includes(id));
        await Promise.all(imageIdsToDelete.map(async (publicId) => {
            if (publicId?.startsWith('project-images/')) {
                try {
                    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
                    console.log(`🧹 Deleted old image from Cloudinary: ${publicId}`, result);
                } catch (err) {
                    console.error(`❌ Failed to delete image ${publicId}:`, err.message);
                }
            }
        }));

        // 🧹 Delete removed videos from Cloudinary
        const videoIdsToDelete = oldVideoIds.filter(id => !newVideoIds.includes(id));
        await Promise.all(videoIdsToDelete.map(async (publicId) => {
            if (publicId?.startsWith('project-videos/')) {
                try {
                    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
                    console.log(`🧹 Deleted old video from Cloudinary: ${publicId}`, result);
                } catch (err) {
                    console.error(`❌ Failed to delete video ${publicId}:`, err.message);
                }
            }
        }));

        // 🧹 Delete replaced main image from Cloudinary
        const mainImageChanged = oldMainImage && oldMainImage !== newMainImage;
        if (mainImageChanged && oldMainImage.startsWith('http')) {
            const publicId = extractPublicId(oldMainImage);
            if (publicId?.startsWith('project-main/')) {
                try {
                    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
                    console.log(`🗑️ Deleted old main image from Cloudinary: ${publicId}`, result);
                } catch (err) {
                    console.error(`❌ Failed to delete main image ${publicId}:`, err.message);
                }
            }
        }

        // 💾 Update database
        const [result] = await db.execute(
            `UPDATE projects SET 
        title = ?, 
        description = ?, 
        mainImage = ?, 
        imageFiles = ?, 
        videoFiles = ?, 
        hashtags = ?, 
        githubLink = ? 
        WHERE id = ?`,
            [
                title ?? null,
                description ?? null,
                newMainImage ?? null,
                JSON.stringify(newImages),
                JSON.stringify(newVideos),
                hashtags ?? null,
                githubLink ?? null,
                parsedId
            ]
        );

        return result.affectedRows > 0;
    },


    deleteById: async (id) => {
        const existing = await Project.findById(id);
        if (!existing) return false;

        let imageFiles = [];
        let videoFiles = [];
        const mainImage = existing.mainImage;

        const extractPublicId = (cloudinaryUrl) => {
            if (typeof cloudinaryUrl !== 'string') return null;

            // Example URL:
            // https://res.cloudinary.com/doo1czuto/image/upload/v1234567890/project-images/my-image_name123.png
            const match = cloudinaryUrl.match(/\/upload\/(?:v\d+\/)?([^\.]+)(?:\.\w+)?$/);
            return match ? match[1] : null;
        };

        try {
            imageFiles = JSON.parse(existing.imageFiles || '[]');
            videoFiles = JSON.parse(existing.videoFiles || '[]');
        } catch (err) {
            console.error('❌ Failed to parse media JSON:', err);
        }

        // 🔁 Combine all media URLs
        const allImages = [...imageFiles];
        if (mainImage && !allImages.includes(mainImage)) {
            allImages.push(mainImage);
        }

        // ✅ Cloudinary deletion: images
        await Promise.all(allImages.map(async (url) => {
            const publicId = extractPublicId(url);
            if (publicId?.startsWith('project-images/') || publicId?.startsWith('project-main/')) {
                try {
                    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
                    console.log(`🧹 Deleted Cloudinary image: ${publicId}`, result);
                } catch (err) {
                    console.error(`❌ Cloudinary image deletion failed: ${publicId}`, err.message);
                }
            }
        }));

        // ✅ Cloudinary deletion: videos
        await Promise.all(videoFiles.map(async (url) => {
            const publicId = extractPublicId(url);
            if (publicId?.startsWith('project-videos/')) {
                try {
                    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
                    console.log(`🧹 Deleted Cloudinary video: ${publicId}`, result);
                } catch (err) {
                    console.error(`❌ Cloudinary video deletion failed: ${publicId}`, err.message);
                }
            }
        }));


        // 🧾 Delete DB row
        const [result] = await db.execute(`DELETE FROM projects WHERE id = ?`, [id]);
        return result.affectedRows > 0;
    }

};

module.exports = Project;
