// const { InstagramScraper } = require('@aduptive/instagram-scraper');

// async function main() {
//     const scraper = new InstagramScraper();

//     try {
//         // Get the last 20 posts from a public profile
//         const results = await scraper.getPosts('instagram', 20);

//         if (results.success && results.posts) {
//             console.log(`Successfully collected ${results.posts.length} posts`);
//             // Save to JSON file
//             await scraper.saveToJson(results);
//         } else {
//             console.error('Error:', results.error);
//         }
//     } catch (error) {
//         console.error('Critical error:', error);
//     }
// }

// main();

const Content = require('../model/content');
const puppeteer = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const fs = require('fs');
const path = require('path');

const chromiumPath = require('puppeteer').executablePath();
process.env.CHROME_BIN = chromiumPath;


puppeteerExtra.use(StealthPlugin());

puppeteerExtra.use(
    RecaptchaPlugin({
        provider: {
            id: '2captcha',
            token: process.env.TWOCAPTCHA_API_KEY // your 2captcha key here
        },
        visualFeedback: true,
        throwOnError: true,  // optional for debug
    })
);

const USERNAME = process.env.IG_USERNAME;
const PASSWORD = process.env.IG_PASSWORD;
const PROFILE = process.env.IG_PROFILE;

exports.debuggingRoute = async (req, res) => {
    const { filename } = req.params;

    // ✅ Whitelist allowed filenames for security
    const allowedFiles = ['login-page', 'login-failure', 'post-login'];
    if (!allowedFiles.includes(filename)) {
        return res.status(400).send('❌ Invalid debug file requested.');
    }

    // 🔒 Prevent path traversal
    const htmlPath = path.join('/tmp', `${filename}.html`);

    try {
        const html = fs.readFileSync(htmlPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (e) {
        console.error(`❌ Failed to read ${htmlPath}:`, e.message);
        res.status(500).send('⚠️ HTML debug file not found or unreadable.');
    }
};

// ⏱️ Simulate human typing delay
const delay = (ms) => new Promise(res => setTimeout(res, ms));
const humanDelay = (min = 50, max = 160) =>
    delay(Math.floor(Math.random() * (max - min + 1)) + min);


function safeWrite(filepath, content) {
    try {
        fs.writeFileSync(filepath, content);
        console.log(`💾 Saved snapshot to ${filepath}`);
    } catch (err) {
        console.warn(`⚠️ Failed to write ${filepath}:`, err.message);
    }
}

async function login(page, username, password) {
    console.log('🚀 Starting login with', username);

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    await page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'networkidle2',
    });

    // 🧩 1. Solve CAPTCHA before doing anything
    let result = await page.solveRecaptchas();
    console.log('🧩 First CAPTCHA solve (before login):', result);

    const loginHTML = await page.content();
    safeWrite('/tmp/login-page.html', loginHTML);

    await page.waitForSelector('input[name="username"]', { timeout: 60000 });
    await delay(1000);

    for (const char of username) {
        await page.type('input[name="username"]', char);
        await humanDelay();
    }

    for (const char of password) {
        await page.type('input[name="password"]', char);
        await humanDelay();
    }

    await page.click('button[type="submit"]');

    // 🕵️ Wait for navigation or redirect after login
    try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    } catch (err) {
        console.warn('⚠️ Navigation timeout after login click, continuing anyway...');
    }

    // 🧩 2. Solve CAPTCHA again after login click (if redirected)
    const urlAfterLogin = page.url();
    const htmlAfterLogin = await page.content();
    safeWrite('/tmp/post-login.html', htmlAfterLogin);

    if (
        urlAfterLogin.includes('/challenge/') ||
        htmlAfterLogin.includes('captcha') ||
        htmlAfterLogin.includes('g-recaptcha')
    ) {
        console.warn('🛑 Looks like we were redirected to CAPTCHA page after login.');

        // Solve the new challenge
        result = await page.solveRecaptchas();
        console.log('🧩 Second CAPTCHA solve (after login):', result);

        // Retry navigation
        try {
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
        } catch {
            console.warn('⚠️ Post-CAPTCHA navigation timeout.');
        }
    }

    const cookies = await page.cookies();
    const postLoginHTML = await page.content();

    const hasSession = cookies.some(c => c.name === 'sessionid' || c.name === 'ds_user_id');
    const isLoggedInUI =
        postLoginHTML.includes('aria-label="Profile"') ||
        postLoginHTML.includes('New post') ||
        postLoginHTML.includes(username);

    if (!hasSession || !isLoggedInUI) {
        console.warn('❌ Login may have failed: session cookie or UI confirmation not found.');
        console.log(postLoginHTML.slice(0, 1000));
    } else {
        console.log('✅ Login successful with active session!');
    }
}





async function fetchInstagramLinks(page, profile) {
    const targetURL = `https://www.instagram.com/${profile}/`;

    console.log(`profile: ${profile}`);
    console.log('🚀 CHROME_BIN:', process.env.CHROME_BIN);

    await page.goto(targetURL, { waitUntil: 'networkidle2' });
    console.log(`🔍 Navigated to profile: ${profile}`);

    const html = await page.content();

    // ✅ Ensure the profile page loaded correctly
    if (!html.includes('/p/') && !html.includes('/reel/')) {
        console.warn('⚠️ Profile page might not have loaded posts correctly.');
        console.log('🔎 HTML preview:\n', html.slice(0, 1000));
        throw new Error('Instagram profile page not loaded or no posts found.');
    }

    // Log HTML head for manual checking
    console.log('🧾 HTML content dump (first 1000 chars):\n', html.slice(0, 1000));

    // 📜 Scroll to load more posts
    const maxScrolls = 30;
    const scrollStep = 300;

    for (let i = 0; i < maxScrolls; i++) {
        const atBottom = await page.evaluate(scrollStep => {
            const { scrollTop, scrollHeight, clientHeight } = document.scrollingElement;
            window.scrollBy(0, scrollStep);
            return scrollTop + clientHeight >= scrollHeight;
        }, scrollStep);

        await new Promise(res => setTimeout(res, 1000));
        if (atBottom) break;
    }

    // ⏱ Let Instagram render icons (important for detecting reel/carousel)
    await new Promise(res => setTimeout(res, 1500));

    const posts = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));

        return anchors.map(a => {
            const href = a.getAttribute('href');

            // Detect type from <title> or aria-label
            const svgTitle = a.querySelector('svg title')?.textContent?.trim() ||
                a.querySelector('svg')?.getAttribute('aria-label')?.trim();

            let type = 'image'; // default fallback
            if (svgTitle === 'Klip' || svgTitle === 'Clip') type = 'reel';
            else if (svgTitle === 'Döngü' || svgTitle === 'Carousel') type = 'carousel';

            return { url: href, type };
        });
    });

    console.log('📌 Found posts:', posts);
    return posts;
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
function getXpvAssetIdFromUrl(url) {
    try {
        const efgMatch = url.match(/[?&]efg=([^&]+)/);
        if (!efgMatch) return null;
        const decoded = JSON.parse(Buffer.from(decodeURIComponent(efgMatch[1]), 'base64').toString());
        return decoded.xpv_asset_id || null;
    } catch (err) {
        console.warn('❌ Failed to parse efg for URL:', url);
        return null;
    }
}

function getVencodeTagFromUrl(url) {
    try {
        const efgMatch = url.match(/[?&]efg=([^&]+)/);
        if (!efgMatch) return null;
        const decoded = JSON.parse(Buffer.from(decodeURIComponent(efgMatch[1]), 'base64').toString());
        return decoded.vencode_tag || null;
    } catch (err) {
        console.warn('❌ Failed to parse vencode_tag for URL:', url, err);
        return null;
    }
}


let mediaContents = [];
let mediaCanditates = [];

const instaTakeContents = async () => {
    let browser;
    const pathToExtension = path.join(__dirname, '2captcha-solver');
    console.log('🚀 CHROME_BIN:', process.env.CHROME_BIN, pathToExtension);
    try {
        browser = await puppeteerExtra.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: puppeteer.executablePath(),
        });

        const page = await browser.newPage();
        await login(page, USERNAME, PASSWORD);

        const posts = await fetchInstagramLinks(page, PROFILE);
        fs.writeFileSync(path.join(__dirname, 'urls.json'), JSON.stringify(posts, null, 2));

        const contents = [];

        for (const post of posts) {
            const baseURL = `https://www.instagram.com${post.url}`;
            console.log(`🔍 Navigating to post: ${baseURL}`);

            if (post.type === 'carousel') {
                let index = 1;
                let maxRedirectThreshold = 2;
                let redirectCount = 0;

                while (true) {
                    const fullURL = `${baseURL}?img_index=${index}`;
                    console.log(`🔄 Trying img_index=${index}`);

                    let found = false;
                    let mediaURL = null;
                    let signature = null;

                    const onRequest = async (req) => {
                        const url = req.url();
                        const sig = getFilenameSignature(url);
                        const xpv = getXpvAssetIdFromUrl(url);
                        const tag = getVencodeTagFromUrl(url); // ✅ Extract vencode_tag

                        console.log('🔍 Checking:', sig);

                        if (
                            (url.includes('.mp4') || url.includes('.jpg') || url.includes('.webp')) &&
                            !url.includes('s150x150') &&                      // ⛔ exclude profile pic sizes
                            !url.includes('/profile_pic') &&                  // ⛔ exclude profile endpoints
                            !found &&
                            sig &&
                            (url.includes('.mp4') ? !mediaContents.some(contents => contents.xpv_asset_id === xpv) : !mediaContents.some(contents => contents.signature === sig)) &&
                            (url.includes('.mp4')
                                ? (!tag.includes('baseline') || tag.includes('baseline_1'))
                                : true)

                        ) {
                            mediaCanditates.push({ url: url, sig: sig, xpv_asset_id: xpv })
                            console.log(`✅ Found media at index ${index}: ${url}, and sig: ${sig}`);
                        }
                    };

                    page.on('request', onRequest);

                    try {
                        await page.goto(fullURL, {
                            waitUntil: 'networkidle2',
                            timeout: 30000,
                        });
                    } catch (err) {
                        console.error(`❌ Failed to navigate to ${fullURL}`, err.message);
                        page.off('request', onRequest);
                        break; // or continue;
                    }
                    await delay(2000); // Extra buffer

                    // ⏳ Wait with retry logic to allow video to arrive
                    let maxWaitTime = 7000; // total max wait time in ms
                    let checkInterval = 250;
                    let elapsed = 0;
                    while (elapsed < maxWaitTime) {
                        if (mediaCanditates.length > 0) break;
                        await delay(checkInterval);
                        elapsed += checkInterval;
                    }

                    page.off('request', onRequest);

                    // 🧠 Check DOM for <video> at current index
                    const hasVideo = await page.evaluate(() => {
                        const items = document.querySelectorAll('ul._acay > li');
                        for (let li of items) {
                            const video = li.querySelector('video');
                            if (video && video.src && !video.src.startsWith('blob:')) {
                                return true; // unlikely to hit because of blob
                            }

                            // fallback: check if <video> tag exists anyway
                            if (video) return true;
                        }
                        return false;
                    });

                    // 🎯 Filter based on hasVideo
                    let filtered = [];
                    if (hasVideo) {
                        filtered = mediaCanditates.filter(m => m.url.includes('.mp4'));
                    } else {
                        filtered = mediaCanditates.filter(m => m.url.includes('.jpg') || m.url.includes('.webp'));
                    }

                    // ✅ Pick best match
                    const bestMedia = filtered[0];
                    mediaCanditates = []; // reset for next round

                    if (bestMedia) {
                        mediaURL = bestMedia.url;
                        signature = bestMedia.sig;
                        mediaContents.push({ signature: signature, xpv_asset_id: bestMedia.xpv_asset_id });
                        found = true;
                        console.log(`✅ Final pick at index ${index}: ${signature}`);
                    } else {
                        console.log(`⛔ No suitable media found at index ${index}`);
                    }

                    // 🚨 Redirect detection
                    const currentURL = await page.evaluate(() => window.location.href);
                    const actualIndex = parseInt(new URL(currentURL).searchParams.get('img_index')) || 1;

                    if (actualIndex === 1 && index > 1) {
                        console.log(`🚨 Silent redirect! Requested img_index=${index}, landed on img_index=${actualIndex}`);
                        redirectCount++;
                        if (redirectCount >= maxRedirectThreshold) {
                            console.log(`❌ Too many redirects. Breaking loop.`);
                            break;
                        }
                        continue;
                    } else {
                        redirectCount = 0;
                    }

                    if (!found || !signature) {
                        console.log(`⛔ No media found at index ${index}. Breaking.`);
                        break;
                    }


                    contents.push({
                        link: mediaURL,
                        type: post.type,
                        img_index: index,
                        postURL: baseURL,
                    });
                    index++;



                }


            } else {
                // For non-carousel posts
                let found = false;
                let mediaURL = null;

                const onRequest = (req) => {
                    const url = req.url();
                    const sig = getFilenameSignature(url)
                    if (
                        (post.type === "image" ? (url.includes('.jpg') || url.includes('.webp')) : url.includes('.mp4')) &&
                        !url.includes('s150x150') &&                      // ⛔ exclude profile pic sizes
                        !url.includes('/profile_pic') &&                  // ⛔ exclude profile endpoints
                        !found &&
                        !mediaContents.includes(sig)
                    ) {
                        mediaURL = url;
                        found = true;
                        console.log(`🎬 Found media:`, url);
                    }
                };

                page.on('request', onRequest);
                await page.goto(baseURL, { waitUntil: 'networkidle2' });
                await delay(3000);
                page.off('request', onRequest);

                if (mediaURL) {
                    contents.push({
                        link: mediaURL,
                        type: post.type,
                        img_index: null,
                        postURL: baseURL,
                    });
                }
            }
        }

        fs.writeFileSync(path.join(__dirname, 'video-urls.json'), JSON.stringify(contents, null, 2));
        console.log('✅ All media URLs saved.');

        await browser.close();
        return contents
    } catch (err) {
        console.error("🔥 Critical error in instaTakeContents:", err.message);
        if (browser) await browser.close();
        throw err;
    }

};


exports.InstaContentSaver = async (req, res, next) => {
    // Respond immediately to client
    res.status(202).json({ message: "Instagram scraping started in background." });

    // Run the actual job in the background
    setTimeout(async () => {
        try {
            const contents = await instaTakeContents();

            if (Array.isArray(contents) && contents.length > 0) {
                console.log(`📌 Found posts: ${contents.length}`);
                await Content.deleteAll();

                const results = [];
                for (let i = 0; i < contents.length; i++) {
                    const result = await Content.create(contents[i], i);
                    results.push(result);
                }

                console.log(`✅ All media URLs saved: ${results.length}`);
            } else {
                console.log("📭 No posts found or invalid content format.");
            }
        } catch (err) {
            console.error("🔥 Background scrape failed:", err);
        }
    }, 0);
};

exports.GetInstaContents = async (req, res, next) => {
    try {
        const result = await Content.findAll();
        console.log(result.length)
        if (result.length === 0) {
            console.log("not found")
            return res.status(404).json({ message: "not found" }); // ✅ Add return here
        }
        res.status(200).json(result);
    } catch (err) {
        console.log("❌ DB error:", err);
        res.status(500).json({ message: "something went wrong while fetching insta contents" }); // 🛠 fixed typo: it was saying 'saving'
    }
};
const fetch = require('node-fetch'); // node-fetch v2
const { Readable } = require('stream');

exports.GetInstaMediaByID = async (req, res) => {
    const { id } = req.params;

    try {
        const content = await Content.findById(id);
        if (!content) {
            return res.status(404).send("Content not found");
        }

        // Remove query params like bytestart and byteend
        const urlObj = new URL(content.link);
        urlObj.searchParams.delete('bytestart');
        urlObj.searchParams.delete('byteend');
        const cleanedURL = urlObj.toString();

        console.log(`🔗 Fetching media: ${cleanedURL}`);

        const response = await fetch(cleanedURL);
        if (!response.ok) {
            console.error("⚠️ Media fetch failed:", response.status, cleanedURL);
            return res.status(502).send("Failed to fetch media from source");
        }

        const contentType = response.headers.get("content-type") || "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=31536000");
        res.setHeader("Access-Control-Allow-Origin", "*");

        // ✅ Convert response.body (ReadableStream) to Node.js stream
        const readableStream = Readable.from(response.body);
        readableStream.pipe(res);
    } catch (err) {
        console.error("❌ Error in GetInstaMediaByID:", err);
        res.status(500).send("Server error while fetching media");
    }
};