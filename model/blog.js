// model/blog.js
const db = require('../db/db');
const fs = require('fs');
const path = require('path');

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

    findBySlug: async (slug) => {
        const [rows] = await db.execute(`SELECT * FROM blogs WHERE slug = ? LIMIT 1`, [slug]);
        return rows[0];
    },

    findById: async (id) => {
        const [rows] = await db.execute(`SELECT * FROM blogs WHERE id = ? LIMIT 1`, [id]);
        return rows[0];
    },

    updateById: async (id, { title, slug, image, excerpt, date, content, imageNames, jsonModel }) => {
        const parsedId = parseInt(id);
        const uploadsDir = path.join(__dirname, '../public/upload');

        console.log("Updating blog with ID:", parsedId);

        const res = await Blog.findById(parsedId);
        if (!res) {
            throw new Error(`Blog with ID ${parsedId} not found`);
        }

        // Parse both imageNames arrays
        let oldImageNames = [];
        let newImageNames = [];
        try {
            oldImageNames = JSON.parse(res.imageNames) || [];
        } catch (err) {
            console.error('❌ Failed to parse old imageNames:', err);
            throw new Error('Invalid old imageNames format');
        }

        try {
            newImageNames = JSON.parse(imageNames) || [];
        } catch (err) {
            console.error('❌ Failed to parse new imageNames:', err);
        }

        // Include the cover image itself (without prefix)
        const oldCoverImage = res.image?.split('/upload/')[1];
        const newCoverImage = image?.split('/upload/')[1];

        console.log('Old image names:', oldImageNames);
        console.log('New image names:', newImageNames);

        if (oldCoverImage) oldImageNames.push(oldCoverImage);
        if (newCoverImage) newImageNames.push(newCoverImage);

        // Get images to delete: in old but not in new
        const toDelete = oldImageNames.filter(img => !newImageNames.includes(img));
        console.log('🧹 Deleting unused images:', toDelete);

        // Delete images from disk
        toDelete.forEach(filename => {
            const filePath = path.join(uploadsDir, filename);
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, err => {
                    if (err) {
                        console.error(`❌ Failed to delete ${filename}:`, err.message);
                    } else {
                        console.log(`✅ Deleted unused image: ${filename}`);
                    }
                });
            }
        });

        // Proceed to update the DB
        const [result] = await db.execute(
            `UPDATE blogs
            SET title = ?, slug = ?, image = ?, excerpt = ?, date = ?, content = ?, imageNames = ?, jsonModel = ?
            WHERE id = ?`,
            [title, slug, image, excerpt, date, content, imageNames, jsonModel, parsedId]
        );

        return result.affectedRows > 0;
    },

    deleteBySlug: async (slug) => {
        // First, fetch the blog to access image info
        const [rows] = await db.execute(`SELECT image, imageNames FROM blogs WHERE slug = ? LIMIT 1`, [slug]);
        const blog = rows[0];
        if (!blog) return false;

        const uploadsDir = path.join(__dirname, '../public/uploads');

        // Collect all image file names
        let filesToDelete = [];

        // Add from imageNames array
        if (blog.imageNames) {
            try {
                const parsed = JSON.parse(blog.imageNames);
                if (Array.isArray(parsed)) {
                    filesToDelete.push(...parsed);
                }
            } catch (err) {
                console.error('❌ Failed to parse imageNames JSON:', err);
            }
        }

        // Add the cover image if not already in list
        if (blog.image) {
            const coverFile = blog.image.split('/upload/')[1];
            if (coverFile && !filesToDelete.includes(coverFile)) {
                filesToDelete.push(coverFile);
            }
        }

        // Delete image files from disk
        filesToDelete.forEach(filename => {
            const filePath = path.join(uploadsDir, filename);
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, err => {
                    if (err) {
                        console.error(`❌ Error deleting ${filename}:`, err.message);
                    } else {
                        console.log(`🗑️ Deleted file: ${filename}`);
                    }
                });
            }
        });

        // Finally, delete the blog row from the database
        const [result] = await db.execute(`DELETE FROM blogs WHERE slug = ?`, [slug]);
        return result.affectedRows > 0;
    }
};

module.exports = Blog;
