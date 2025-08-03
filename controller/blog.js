const Blog = require('../model/blog');
const multer = require('multer');
const path = require('path')
const fs = require('fs')
const { uploadToCloudinary } = require('../utils/cloudinary'); // ✅ your util

// // Setup multer (already correct in your case)
// const upload = multer({
//     storage: multer.diskStorage({
//         destination: (req, file, cb) => {
//             const dir = path.join(__dirname, '../public/upload');
//             if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
//             cb(null, dir);
//         },
//         filename: (req, file, cb) => {
//             cb(null, file.originalname);
//         },
//     }),
// }).fields([
//     { name: 'coverImage', maxCount: 1 },
//     { name: 'images', maxCount: 20 },
// ]);

exports.SaveJSON = (req, res) => {
    try {
        const bodyData = req.body;

        if (!bodyData || typeof bodyData !== 'object') {
            return res.status(400).json({ error: 'Invalid or missing JSON body' });
        }

        const { id } = bodyData;

        if (!id) {
            return res.status(400).json({ error: 'Missing blog ID in JSON' });
        }

        const savePath = path.join(__dirname, `../public/upload/blog/blog-${id}.json`);

        fs.writeFileSync(savePath, JSON.stringify(bodyData, null, 2), 'utf-8');

        console.log(`✅ Saved blog JSON to ${savePath}`);
        return res.status(200).json({ success: true, message: 'JSON saved successfully' });
    } catch (err) {
        console.error('❌ SaveJSON error:', err);
        return res.status(500).json({ error: 'Server error while saving JSON' });
    }
};

const CleanJSON = (id) => {
    try {
        const savePath = path.join(__dirname, `../public/upload/blog/blog-${id}.json`);

        if (fs.existsSync(savePath)) {
            fs.unlinkSync(savePath); // delete file
        }

        console.log('JSON File Cleaned...')

    } catch (err) {
        console.error('❌ CleanJSON error:', err);
    }
};



exports.UploadBlogImage = (req, res) => {
    console.log('image request hitted')
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, '../public/upload/blog');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            const base = path.basename(file.originalname, ext);

            const sanitizedBase = base
                .toLowerCase()
                .replace(/\s+/g, '_')       // replace spaces with underscores
                .replace(/[^\w\-]/g, '')    // remove non-word characters
                .slice(0, 50);              // optional length limit

            const finalName = `${Date.now()}-${sanitizedBase}${ext}`;
            cb(null, finalName); // ✅ sanitized, timestamped filename
        },
    });

    const upload = multer({ storage }).fields([
        { name: 'image', maxCount: 1 },
    ]);

    upload(req, res, (err) => {
        if (err) {
            console.error('❌ Upload error:', err);
            return res.status(500).json({ error: 'Image upload failed' });
        }

        const uploaded = [];

        if (req.files?.images) {
            uploaded.push(...req.files.images.map(f => f.filename));
        }

        if (req.files?.image) {
            uploaded.push(req.files.image[0].filename);
        }

        res.status(200).json({ success: true, uploaded, fileName: uploaded[0] });
    });
};




exports.PostBlog = async (req, res) => {
    try {
        const { id, title, slug, excerpt, date, content, image, imageNames, jsonModel } = req.body;

        const oldId = id;
        if (!title || !slug || !content) {
            return res.status(400).json({ error: 'Missing title, slug, or html content' });
        }

        const uploadDir = path.join(__dirname, '../public/upload/blog');

        // Step 1: Upload Cover Image
        let coverCloudinary = null;
        if (image) {
            const coverPath = path.join(uploadDir, image);
            if (fs.existsSync(coverPath)) {
                coverCloudinary = await uploadToCloudinary(coverPath, null, 'blog-covers');
                fs.unlinkSync(coverPath);
            }
        }

        // Step 2: Upload Content Images
        let contentUploads = [];
        const parsedImageNames = typeof imageNames === 'string' ? JSON.parse(imageNames) : imageNames;

        if (Array.isArray(parsedImageNames)) {
            for (const name of parsedImageNames) {
                const imgPath = path.join(uploadDir, name);
                if (fs.existsSync(imgPath)) {
                    const result = await uploadToCloudinary(imgPath, null, 'blog-images');
                    contentUploads.push({
                        original: name,
                        url: result.url,
                        cloudinaryId: result.public_id // typically something like 'blog-images/filename'
                    });
                    fs.unlinkSync(imgPath);
                }
            }
        }

        const updatedImageNames = contentUploads.map(img => img.url);

        // Step 3: Rewrite image srcs in Lexical JSON
        const blogInput = typeof jsonModel === 'string'
            ? JSON.parse(jsonModel)
            : jsonModel;

        const updatedContent = blogInput.content;

        const replaceImageURLs = (node) => {
            if (node?.type === 'image' && node.src) {
                const match = contentUploads.find(img => node.src.includes(img.original));
                if (match) {
                    // ✅ Replace with full Cloudinary URL
                    node.src = match.url;

                    // Optional: Also keep simplified version if needed (not required by Lexical though)
                    node.cloudinaryId = match.cloudinaryId; // store Cloudinary public_id
                }
            }

            if (Array.isArray(node.children)) {
                node.children.forEach(replaceImageURLs);
            }
        };

        if (updatedContent?.root?.children) {
            replaceImageURLs(updatedContent.root);
        } else {
            console.warn('⚠️ Invalid Lexical JSON:', updatedContent);
        }

        // Step 4: Save blog JSON to file
        const blogJSON = {
            id: null, // will be filled after DB
            title,
            slug,
            excerpt,
            date,
            coverImage: coverCloudinary?.url || null,
            imageNames: updatedImageNames,
            content: updatedContent
        };

        const blogsDir = path.join(__dirname, '../public/blogs');
        if (!fs.existsSync(blogsDir)) fs.mkdirSync(blogsDir, { recursive: true });

        const savePath = path.join(blogsDir, `${slug}.json`);
        fs.writeFileSync(savePath, JSON.stringify(blogJSON, null, 2), 'utf-8');

        // Step 5: Save to DB with updated imageNames
        const blogId = await Blog.create({
            title,
            slug,
            excerpt,
            date,
            image: blogJSON.coverImage,
            content,
            imageNames: JSON.stringify(updatedImageNames),
            jsonModel: JSON.stringify(blogInput),
        });

        blogJSON.id = blogId;
        fs.writeFileSync(savePath, JSON.stringify(blogJSON, null, 2), 'utf-8');

        CleanJSON(oldId);

        return res.status(201).json({
            success: true,
            blogId,
            coverImageUrl: blogJSON.coverImage,
            message: 'Blog saved and uploaded successfully.',
        });

    } catch (e) {
        console.error('❌ Blog save or upload error:', e);
        return res.status(500).json({ error: 'Blog creation failed' });
    }
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
        console.log(slug)
        if (!slug) return res.status(400).json({ error: 'Invalid ID' });

        const item = await Blog.findBySlug(slug);
        if (!item) return res.status(404).json({ error: 'Project not found' });

        res.json({ success: true, blog: item });
    } catch (err) {
        console.error('❌ Error fetching project:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.GetBlogJSON = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'Missing id parameter' });

        const blogsDir = path.join(__dirname, '../public/upload/blog');
        const jsonPath = path.join(blogsDir, `blog-${id}.json`);

        // ✅ Step 1: If file exists, serve from JSON
        if (fs.existsSync(jsonPath)) {
            const fileData = fs.readFileSync(jsonPath, 'utf-8');
            const parsedBlog = JSON.parse(fileData);
            console.log(`📄 Served from blog JSON: ${id}.json`);
            return res.status(200).json({ success: true, blog: parsedBlog });
        }

        // 🔄 Step 2: Fallback to DB if file doesn't exist
        console.log("📦 Fetching blog from DB...");
        const blog = await Blog.findById(id);
        if (!blog) return res.status(404).json({ error: 'Blog not found' });

        // 🧠 Parse fields
        const parsedImageNames = typeof blog.imageNames === 'string'
            ? JSON.parse(blog.imageNames)
            : blog.imageNames;

        const parsedJsonModel = typeof blog.jsonModel === 'string'
            ? JSON.parse(blog.jsonModel)
            : blog.jsonModel;

        const blogJSON = {
            id: blog.id,
            title: blog.title,
            slug: blog.slug,
            excerpt: blog.excerpt,
            date: blog.date,
            coverImage: blog.image,
            imageNames: parsedImageNames || [],
            content: parsedJsonModel?.content || {}
        };

        // ✏️ Create directory if needed and write file
        if (!fs.existsSync(blogsDir)) fs.mkdirSync(blogsDir, { recursive: true });
        fs.writeFileSync(jsonPath, JSON.stringify(blogJSON, null, 2), 'utf-8');
        console.log(`✅ Created blog JSON: blog-${id}.json`);

        return res.status(200).json({ success: true, blog: blogJSON });

    } catch (e) {
        console.error('❌ Blog fetch error:', e);
        return res.status(500).json({ error: 'Failed to fetch blog' });
    }
};

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
        const { id } = req.params;
        if (!id) res.status(400).json({ error: 'Missing id parameter' });
        console.log("Fetching blogs from DB...");
        const response = await Blog.deleteById(id);
        res.status(200).json({ success: true, response });
    } catch (e) {
        console.error('DB error:', e);
        res.status(500).json({ error: 'Failed to fetch blogs' });
    }
}

exports.PutBlog = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'Missing blog ID' });

        const {
            title,
            slug,
            excerpt,
            date,
            content,
            image,        // e.g. 'cover.png'
            imageNames,   // e.g. '["img1.png", "img2.jpg"]'
            jsonModel     // Lexical content JSON
        } = req.body;

        if (!title || !slug || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const uploadDir = path.join(__dirname, '../public/upload/blog');

        // Step 1: Upload Cover Image to Cloudinary
        let coverCloudinary = null;
        if (image) {
            const coverPath = path.join(uploadDir, image);
            if (fs.existsSync(coverPath)) {
                coverCloudinary = await uploadToCloudinary(coverPath, null, 'blog-covers');
                fs.unlinkSync(coverPath);
            }
        }

        // Step 2: Upload Blog Content Images to Cloudinary
        const parsedImageNames = typeof imageNames === 'string' ? JSON.parse(imageNames) : imageNames;
        let contentUploads = [];

        if (Array.isArray(parsedImageNames)) {
            for (const name of parsedImageNames) {
                const imgPath = path.join(uploadDir, name);
                if (fs.existsSync(imgPath)) {
                    const result = await uploadToCloudinary(imgPath, null, 'blog-images');
                    contentUploads.push({
                        original: name,
                        url: result.url,
                        cloudinaryId: result.public_id
                    });
                    fs.unlinkSync(imgPath);
                }
            }
        }

        // Step 3: Update Lexical JSON content with Cloudinary URLs
        // const simplifyCloudinaryURL = (fullURL) => {
        //     const match = fullURL.match(/\/upload\/(v\d+\/.+)$/);
        //     return match ? match[1] : fullURL;
        // };

        const replaceImageURLs = (node) => {
            if (node?.type === 'image' && node.src) {
                const match = contentUploads.find(img => node.src.includes(img.original));
                if (match) {
                    node.src = match.url; // full Cloudinary URL
                    node.cloudinaryId = match.cloudinaryId;
                }
            }

            if (Array.isArray(node.children)) {
                node.children.forEach(replaceImageURLs);
            }
        };

        const blogInput = typeof jsonModel === 'string'
            ? JSON.parse(jsonModel)
            : jsonModel;

        const updatedContent = blogInput.content;
        if (updatedContent?.root?.children) {
            replaceImageURLs(updatedContent.root);
        } else {
            console.warn('⚠️ Invalid Lexical JSON:', updatedContent);
        }

        // Step 4: Update DB with final data
        const updatedImageNames = contentUploads.map(img => img.url); // full Cloudinary URLs

        const result = await Blog.updateById(id, {
            title,
            slug,
            excerpt,
            date,
            content,
            image: coverCloudinary?.url || image,
            imageNames: JSON.stringify(updatedImageNames),
            jsonModel: JSON.stringify({ ...blogInput, content: updatedContent })
        });

        console.log(image, coverCloudinary)

        CleanJSON(id);

        return res.status(200).json({
            success: true,
            result,
            uploaded: {
                coverImage: coverCloudinary?.url,
                contentImages: contentUploads.map(img => img.url),
            }
        });

    } catch (err) {
        console.error('❌ PutBlog error:', err);
        return res.status(500).json({ error: 'Failed to update blog' });
    }
};


