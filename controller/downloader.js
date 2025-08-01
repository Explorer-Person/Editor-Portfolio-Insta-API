const fs = require('fs');
const axios = require('axios');
const path = require('path');
const { URL } = require('url');

async function downloadInstagramCDNVideo(originalUrl, filename) {
    const filepath = path.resolve(__dirname, 'contents', filename);

    // Ensure the folder exists
    if (!fs.existsSync(path.dirname(filepath))) {
        fs.mkdirSync(path.dirname(filepath), { recursive: true });
    }

    // ✅ Clean URL: remove bytestart and byteend
    const cleanedUrl = (() => {
        try {
            const parsed = new URL(originalUrl);
            parsed.searchParams.delete('bytestart');
            parsed.searchParams.delete('byteend');
            return parsed.toString();
        } catch (e) {
            console.error(`❌ Invalid URL: ${originalUrl}`);
            return originalUrl;
        }
    })();

    try {
        const response = await axios({
            url: cleanedUrl,
            method: 'GET',
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0',
            },
            timeout: 60000,
        });

        const writer = fs.createWriteStream(filepath);
        return new Promise((resolve, reject) => {
            response.data.pipe(writer);
            writer.on('finish', () => {
                console.log('✅ Downloaded:', filename);
                resolve();
            });
            writer.on('error', (err) => {
                console.error('❌ Write error:', filename, err.message);
                reject(err);
            });
        });
    } catch (err) {
        console.error('❌ Failed to download:', filename, '| Reason:', err.message);
    }
}

function getFilenameSignature(url) {
    try {
        const u = new URL(url);
        console.log(u.pathname.split('/').pop())
        return u.pathname.split('/').pop(); // e.g. 469088879_..._n.jpg
    } catch {
        return null;
    }
}

async function mediaDownloadingAutomation() {
    const raw = fs.readFileSync(path.join(__dirname, 'video-urls.json'), 'utf-8');
    const arr = JSON.parse(raw);

    for (const element of arr) {
        const filename = getFilenameSignature(element.link)
        await downloadInstagramCDNVideo(element.link, filename);
    }

    console.log('🎉 All videos downloaded!');
}

mediaDownloadingAutomation();
