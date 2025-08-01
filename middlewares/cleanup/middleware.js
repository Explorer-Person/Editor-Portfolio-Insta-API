const fs = require('fs');
const path = require('path');
const db = require('../../db/db');

const uploadsDir = path.join(__dirname, '../../public/upload');
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // every 24 hours
// const CLEANUP_INTERVAL_MS = 1000; // use for fast testing

async function cleanupUnusedImages() {
    try {
        const [rows] = await db.execute('SELECT image, imageNames FROM blogs');
        const usedImages = new Set();

        for (const row of rows) {
            if (row.image?.includes('/upload/')) {
                const file = row.image.split('/upload/')[1];
                if (file) usedImages.add(file);
            }

            if (row.imageNames) {
                try {
                    const list = JSON.parse(row.imageNames);
                    if (Array.isArray(list)) list.forEach(img => usedImages.add(img));
                } catch (err) {
                    console.warn('⚠️ Invalid imageNames JSON:', row.imageNames);
                }
            }
        }

        const allFiles = await fs.promises.readdir(uploadsDir);
        const toDelete = allFiles.filter(file => !usedImages.has(file));

        await Promise.all(toDelete.map(async file => {
            const filePath = path.join(uploadsDir, file);
            try {
                await fs.promises.unlink(filePath);
                console.log(`🗑️ Deleted: ${file}`);
            } catch (err) {
                console.error(`❌ Failed to delete ${file}: ${err.message}`);
            }
        }));

        console.log(`✅ Cleanup finished. Removed ${toDelete.length} file(s).`);
    } catch (err) {
        console.error('❌ Image cleanup failed:', err.message);
    }
}

// Immediately run once when app starts
cleanupUnusedImages();

// Schedule periodic cleanup
setInterval(() => {
    console.log('🧼 Scheduled image cleanup starting...');
    cleanupUnusedImages();
}, CLEANUP_INTERVAL_MS);
