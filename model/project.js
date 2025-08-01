// model/project.js
const db = require('../db/db');
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '../public/upload');

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

    updateById: async (id, { title, description, mainImage, imageFiles, videoFiles, hashtags, githubLink }) => {
        console.log(id, title, description, mainImage, imageFiles, videoFiles, hashtags, githubLink);


        const existing = await Project.findById(id);
        if (!existing) throw new Error(`Project with ID ${parsedId} not found`);

        // Extract and normalize
        const oldImages = JSON.parse(existing.imageFiles);
        const oldVideos = JSON.parse(existing.videoFiles);
        const oldMainImage = existing.mainImage;
        const newImages = imageFiles;
        const newVideos = videoFiles;
        const newMainImage = mainImage;

        console.log('Old images:', oldImages);
        console.log('New images:', newImages);
        console.log('Old videos:', oldVideos);
        console.log('New videos:', newVideos);

        if(oldImages.length > newImages.length) {
            const result = await oldImages.filter(img => !newImages.includes(img));
            console.log('Images to delete:', result);
            result.forEach(file => {
                const imgPath = path.join(uploadsDir, 'imageFiles', file);
                if (fs.existsSync(imgPath)) {
                    fs.unlinkSync(imgPath);
                    console.log(`🗑️ Deleted image: ${file}`);
                }
            });
        }
        if(oldVideos.length > newVideos.length) {
            const result = await oldVideos.filter(vid => !newVideos.includes(vid));
            console.log('Videos to delete:', result);
            result.forEach(file => {
                const vidPath = path.join(uploadsDir, 'videoFiles', file);
                if (fs.existsSync(vidPath)) {
                    fs.unlinkSync(vidPath);
                    console.log(`🗑️ Deleted video: ${file}`);
                }
            });
        }
        if(oldMainImage && oldMainImage !== newMainImage) {
            const mainImgPath = path.join(uploadsDir, 'mainImage', oldMainImage);
            if (fs.existsSync(mainImgPath)) {
                fs.unlinkSync(mainImgPath);
                console.log(`🗑️ Deleted main image: ${oldMainImage}`);
            }
        }

        

        // 📝 Final update to database
        const [result] = await db.execute(
            `UPDATE projects SET 
            title = ?, description = ?, mainImage = ?, imageFiles = ?, 
            videoFiles = ?, hashtags = ?, githubLink = ? 
            WHERE id = ?`,
            [
                title ?? null,
                description ?? null,
                mainImage,
                imageFiles,
                videoFiles,
                hashtags ?? null,
                githubLink ?? null,
                id
            ]
        );

        return result.affectedRows > 0;
    },


    deleteById: async (id) => {
        const existing = await Project.findById(id);
        if (!existing) return false;

        let imageFiles = [];
        let videoFiles = [];

        try {
            imageFiles = JSON.parse(existing.imageFiles || '[]');
            videoFiles = JSON.parse(existing.videoFiles || '[]');
        } catch (err) {
            console.error('❌ Failed to parse media JSON:', err);
        }

        // Add main image if exists
        const mainImage = existing.mainImage;
        if (mainImage && !imageFiles.includes(mainImage)) {
            imageFiles.push(mainImage);
        }

        imageFiles.forEach(file => {
            if (typeof file === 'string' && file.trim() !== '') {
                const imgPath = path.join(uploadsDir, 'imageFiles', file);
                if (fs.existsSync(imgPath)) {
                    fs.unlink(imgPath, err => {
                        if (err) console.error(`❌ Failed to delete image ${file}:`, err.message);
                        else console.log(`🗑️ Deleted image: ${file}`);
                    });
                }
            }
        });

        // Delete video files
        videoFiles.forEach(file => {
            if (typeof file === 'string' && file.trim() !== '') {
                const vidPath = path.join(uploadsDir, 'videoFiles', file);
                if (fs.existsSync(vidPath)) {
                    fs.unlink(vidPath, err => {
                        if (err) console.error(`❌ Failed to delete video ${file}:`, err.message);
                        else console.log(`🗑️ Deleted video: ${file}`);
                    });
                }
            }
        });

        if (typeof mainImage === 'string' && mainImage.trim() !== '') {
            const vidPath = path.join(uploadsDir, 'mainImage', mainImage);
            if (fs.existsSync(vidPath)) {
                fs.unlink(vidPath, err => {
                    if (err) console.error(`❌ Failed to delete video ${mainImage}:`, err.message);
                    else console.log(`🗑️ Deleted video: ${mainImage}`);
                });
            }
        }

        // Delete DB row
        const [result] = await db.execute(`DELETE FROM projects WHERE id = ?`, [id]);
        return result.affectedRows > 0;
    },

};

module.exports = Project;
