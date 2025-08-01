const Blog = require('../model/blog');
const multer = require('multer');
const path = require('path')
const fs = require('fs')

// Setup multer (already correct in your case)
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, '../public/upload');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        },
    }),
}).fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'images', maxCount: 20 },
]);


exports.UploadBlogImagesFromJSON = (req, res) => {
    const uploadImagesOnly = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                const dir = path.join(__dirname, '../public/upload');
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                cb(null, dir);
            },
            filename: (req, file, cb) => {
                cb(null, file.originalname); // keep original file name
            },
        }),
    }).array('images', 20); // `images` field from FormData

    uploadImagesOnly(req, res, (err) => {
        if (err) {
            console.error('❌ Upload error:', err);
            return res.status(500).json({ error: 'Image upload failed' });
        }

        const savedFiles = req.files?.map(f => f.filename) || [];
        res.status(200).json({ success: true, uploaded: savedFiles });
    });
};



exports.PostBlog = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error('Upload error:', err);
            return res.status(500).json({ error: 'Image upload failed' });
        }

        try {
            console.log('✅ req.body:', req.body);
            const { content, slug, title, excerpt, date, image, imageNames, jsonModel } = req.body;

            // Parse image file names from uploaded files

            console.log(content, slug, title, excerpt, date, image, imageNames, jsonModel);
            // Validation
            if (!title || !slug || !content) {
                return res.status(400).json({ error: 'Missing title, slug, or html content' });
            }


            // Save blog to DB
            const blogId = await Blog.create({
                title,
                slug,
                excerpt,
                date,
                image, // cover image (as string)
                content: content,
                imageNames: JSON.stringify(imageNames), // store image references
                jsonModel: jsonModel // store the entire JSON model
            });

            res.status(201).json({ success: true, blogId, uploaded: imageNames });
        } catch (e) {
            console.error('DB error:', e);
            res.status(500).json({ error: 'Blog creation failed' });
        }
    });
};

exports.GetBlog = async (req, res) => {
    try {
        console.log("Fetching blogs from DB...");
        const blogs = await Blog.findAll({});
        res.status(200).json({ success: true, blogs });
    } catch (e) {
        console.error('DB error:', e);
        res.status(500).json({ error: 'Failed to fetch blogs' });
    }
}

exports.GetOneBlog = async (req, res) => {
    try {
        const { slug } = req.params;
        if (!slug) res.status(400).json({ error: 'Missing slug parameter' });
        console.log("Fetching blogs from DB...");
        const blog = await Blog.findBySlug(slug);
        res.status(200).json({ success: true, blog });
    } catch (e) {
        console.error('DB error:', e);
        res.status(500).json({ error: 'Failed to fetch blogs' });
    }
}

const archiver = require('archiver');

exports.DownloadImageBundle = async (req, res) => {
    const { slug } = req.params;
    const blog = await Blog.findBySlug(slug);
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.attachment(`${slug}-images.zip`);
    archive.pipe(res);

    const uploadDir = path.join(__dirname, '../public/upload');

    const files = [];

    if (blog.image) files.push(blog.image);
    if (blog.imageNames) {
        const clean = blog.imageNames.replace(/^"+|"+$/g, '').split(',');
        files.push(...clean);
    }

    for (const filename of files) {
        const fullPath = path.join(uploadDir, filename.replace('/upload/', ''));
        if (fs.existsSync(fullPath)) {
            archive.file(fullPath, { name: path.basename(fullPath) });
        }
    }

    archive.finalize();
};

exports.DeleteBlog = async (req, res) => {
    try {
        const { slug } = req.params;
        if (!slug) res.status(400).json({ error: 'Missing slug parameter' });
        console.log("Fetching blogs from DB...");
        const response = await Blog.deleteBySlug(slug);
        res.status(200).json({ success: true, response });
    } catch (e) {
        console.error('DB error:', e);
        res.status(500).json({ error: 'Failed to fetch blogs' });
    }
}


// Your update controller
exports.PutBlog = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error('❌ Multer error:', err);
            return res.status(500).json({ error: 'Image upload failed' });
        }

        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'Missing blog ID' });

        console.log('✅ req.body:', req.body);

        const {
            title,
            slug,
            excerpt,
            date,
            content,
            image,        // expected to be string path like '/upload/xxx.jpg'
            imageNames,   // CSV: "img1.png,img2.jpg"
            jsonModel     // serialized JSON
        } = req.body;

        if (!title || !slug || !content) {
            return res.status(400).json({ error: 'Missing required fields: title, slug, or content' });
        }

        // // Optional: parse imageNames if you want array in backend
        // const imageNamesArray = imageNames?.split(',') || [];

        

        // Proceed with update logic
        try {
            const result = await Blog.updateById(id, {
                title,
                slug,
                excerpt,
                date,
                content,
                image,         // use directly from body (string path)
                imageNames,    // or array if you convert
                jsonModel: jsonModel,
            });

            res.status(200).json({ success: true, result });
        } catch (err) {
            console.error('❌ Blog update failed:', err);
            res.status(500).json({ error: 'Failed to update blog' });
        }
    });
};

