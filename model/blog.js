// model/blog.js
const db = require('../db/db');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const Blog = {
    init: async () => {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS blogs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                image VARCHAR(255),
                excerpt TEXT,
                date DATE,
                content LONGTEXT,
                imageNames TEXT,
                jsonModel LONGTEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table "blogs" is ready.');
    },

    create: async ({ title, slug, image, excerpt, date, content, imageNames, jsonModel }) => {
        const [result] = await db.execute(
            `INSERT INTO blogs (title, slug, image, excerpt, date, content, imageNames, jsonModel)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, slug, image, excerpt, date, content, imageNames, jsonModel]
        );
        return result.insertId;
    },

    findAll: async () => {
        const [rows] = await db.execute(`SELECT * FROM blogs ORDER BY date DESC`);
        return rows;
    },

    findById: async (id) => {
        const [rows] = await db.execute(`SELECT * FROM blogs WHERE id = ? LIMIT 1`, [id]);
        return rows[0];
    },

    findBySlug: async (slug) => {
        const [rows] = await db.execute(`SELECT * FROM blogs WHERE slug = ? LIMIT 1`, [slug]);
        return rows[0];
    },

    updateById: async (id, { title, slug, image, excerpt, date, content, imageNames, jsonModel }) => {
        const parsedId = parseInt(id);
        console.log("🛠️ Updating blog with ID:", parsedId);

        const extractPublicId = (fullPath) => {
            // Example: fullPath = "v1754137968/blog-covers/xyz.jpg"
            const match = fullPath.match(/\/upload\/(?:v\d+\/)?(.+?)$/);
            return match ? match[1].replace(/\.[a-zA-Z]+$/, '') : null;
        };

        const res = await Blog.findById(parsedId);
        if (!res) {
            throw new Error(`Blog with ID ${parsedId} not found`);
        }

        // Step 1: Parse image name arrays
        let oldImageNames = [];
        let newImageNames = [];

        try {
            oldImageNames = JSON.parse(res.imageNames) || [];
        } catch (err) {
            console.error('❌ Failed to parse old imageNames:', err);
        }

        try {
            newImageNames = JSON.parse(imageNames) || [];
        } catch (err) {
            console.error('❌ Failed to parse new imageNames:', err);
        }

        // Step 2: Detect changed cover image
        const oldCover = res.image?.split('/upload/')[1]; // e.g., blog-covers/xxx
        const newCover = image?.split('/upload/')[1];

        const coverImageChanged = oldCover && oldCover !== newCover;
        if (coverImageChanged) {
            try {
                const publicId = extractPublicId(res.image); // remove extension
                const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
                console.log(`🗑️ Deleted old cover image: ${publicId}`, result);
            } catch (err) {
                console.error('❌ Failed to delete old cover image:', err.message);
            }
        }

        // Step 3: Detect unused blog content images
        const toDelete = oldImageNames.filter(oldImg => !newImageNames.includes(oldImg));
        console.log('🧹 Content images to delete:', toDelete);

        const deleteFromCloudinary = async (publicPath) => {
            const publicId = extractPublicId(publicPath); // strip file extension
            console.log("need to deletion,,,", publicId)

            if (!publicId) return;

            try {
                const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
                console.log(`✅ Deleted from Cloudinary: ${publicId}`, result);
            } catch (err) {
                console.error(`❌ Error deleting ${publicId}:`, err.message);
            }
        };

        await Promise.all(toDelete.map(deleteFromCloudinary));

        const formatDate = (isoString) => {
            if (!isoString || typeof isoString !== 'string') return null;
            return isoString.split('T')[0]; // returns only YYYY-MM-DD
        };

        const formattedDate = formatDate(date);

        // Step 4: Proceed to DB update
        const [result] = await db.execute(
            `UPDATE blogs
                SET title = ?, slug = ?, image = ?, excerpt = ?, date = ?, content = ?, imageNames = ?, jsonModel = ?
                WHERE id = ?`,
            [title, slug, image, excerpt, formattedDate, content, imageNames, jsonModel, parsedId]
        );

        return result.affectedRows > 0;
    },



    deleteById: async (id) => {
        const extractCloudinaryPublicId = (cloudinaryPath) => {
            const match = cloudinaryPath.match(/\/upload\/(?:v\d+\/)?(.+?)$/);
            if (!match) return null;
            const pathWithoutExt = match[1].replace(/\.[a-zA-Z]+$/, ''); // remove file extension
            return pathWithoutExt; // e.g. blog-images/filename
        };
        const [rows] = await db.execute(
            `SELECT image, imageNames FROM blogs WHERE id = ? LIMIT 1`,
            [id]
        );
        const blog = rows[0];
        if (!blog) return false;

        // 🔍 1. Collect all Cloudinary public_ids to delete
        let cloudinaryIdsToDelete = [];

        if (blog.imageNames) {
            try {
                const parsed = JSON.parse(blog.imageNames);
                if (Array.isArray(parsed)) {
                    for (const imgPath of parsed) {
                        const publicId = extractCloudinaryPublicId(imgPath);
                        if (publicId) cloudinaryIdsToDelete.push(publicId);
                    }
                }
            } catch (err) {
                console.error('❌ Failed to parse imageNames JSON:', err);
            }
        }

        if (blog.image) {
            const publicId = extractCloudinaryPublicId(blog.image);
            if (publicId && !cloudinaryIdsToDelete.includes(publicId)) {
                cloudinaryIdsToDelete.push(publicId);
            }
        }

        // 🧹 2. Delete from Cloudinary
        for (const publicId of cloudinaryIdsToDelete) {
            try {
                const result = await uploader.destroy(publicId);
                console.log(`🗑️ Deleted from Cloudinary: ${publicId}`, result);
            } catch (err) {
                console.error(`❌ Cloudinary deletion failed for ${publicId}:`, err.message);
            }
        }

        // 🗑️ 3. Delete blog from DB
        const [result] = await db.execute(
            `DELETE FROM blogs WHERE id = ?`,
            [id]
        );

        return result.affectedRows > 0;
    }
};

module.exports = Blog;
