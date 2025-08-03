const Project = require('../model/project');
const fs = require('fs');
const path = require('path');
const { uploadToCloudinary } = require('../utils/cloudinary'); // ✅ your util

const multer = require('multer');


// 🛠 Setup Multer storage dynamically based on fieldname
const projectStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const folder = 'upload/project';
        const dir = path.join(process.cwd(), 'public', folder);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); // optionally generate unique name here
    }
});

const upload = multer({ storage: projectStorage }).any();

exports.UploadProjectMedia = (req, res) => {
    upload(req, res, err => {
        if (err) {
            console.error('❌ Upload error:', err);
            return res.status(500).json({ success: false, error: 'Upload failed' });
        }

        const result = {};
        for (const file of req.files) {
            if (!result[file.fieldname]) result[file.fieldname] = [];
            result[file.fieldname].push(file.originalname);
        }

        console.log('✅ Uploaded project media:', result);
        return res.json({ success: true, uploaded: result });
    });
};

const CleanJSON = (id) => {
    try {
        const savePath = path.join(__dirname, `../public/upload/project/project-${id}.json`);

        if (fs.existsSync(savePath)) {
            fs.unlinkSync(savePath); // delete file
        }

        console.log('JSON File Cleaned...')

    } catch (err) {
        console.error('❌ CleanJSON error:', err);
    }
};




exports.SaveJSON = (req, res, next) => {
    try {
        const jsonData = req.body;

        console.log(jsonData)

        if (!jsonData || typeof jsonData !== 'object') {
            return res.status(400).json({ error: 'Invalid JSON data' });
        }

        // Optional: require a slug or id field to name the file
        const saveDir = path.join(__dirname, '../public/upload/project');

        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }

        const savePath = path.join(saveDir, `project-${jsonData.id}.json`);
        fs.writeFileSync(savePath, JSON.stringify(jsonData, null, 2), 'utf-8');

        console.log(`✅ Saved JSON to: ${savePath}`);
        return res.status(200).json({ success: true, message: 'JSON saved successfully', path: `upload/project/project-${jsonData.id}.json` });
    } catch (err) {
        console.error('❌ Failed to save JSON:', err);
        return res.status(500).json({ error: 'Failed to save JSON file' });
    }
};


exports.PostProject = async (req, res) => {
    try {
        const {
            id,
            title,
            description,
            mainImage,
            imageFiles,
            videoFiles,
            hashtags,
            githubLink,
        } = req.body;

        if (!title || !description) {
            return res.status(400).json({ error: 'Title and description are required' });
        }

        console.log('📥 Request body:', req.body);

        const uploadDir = path.join(__dirname, '../public/upload/project');

        /**
         * Upload a local file to Cloudinary with proper resource_type
         * @param {string} fileName - local file name in /upload/project
         * @param {string} folder - target Cloudinary folder
         * @param {'image' | 'video'} resourceType
         */
        const uploadIfExists = async (fileName, folder, resourceType = 'image') => {
            const fullPath = path.join(uploadDir, fileName);

            if (!fs.existsSync(fullPath)) {
                console.warn(`⚠️ File not found: ${fullPath}`);
                return null;
            }

            try {
                const result = await uploadToCloudinary(fullPath, { resource_type: resourceType }, folder);
                fs.unlinkSync(fullPath); // ✅ Clean local file after upload
                return {
                    url: result.url,
                    cloudinaryId: result.public_id,
                };
            } catch (err) {
                console.error(`❌ Upload failed [${resourceType}]:`, fileName, err.message);
                return null;
            }
        };

        // 1️⃣ Upload Main Image
        let mainImageCloud = null;
        if (mainImage) {
            mainImageCloud = await uploadIfExists(mainImage, 'project-main', 'image');
        }

        // 2️⃣ Upload Image Files
        let uploadedImages = [];
        const imageArray = typeof imageFiles === 'string' ? JSON.parse(imageFiles) : imageFiles;
        if (Array.isArray(imageArray)) {
            for (const img of imageArray) {
                const result = await uploadIfExists(img, 'project-images', 'image');
                if (result) {
                    uploadedImages.push({
                        original: img,
                        url: result.url,
                        cloudinaryId: result.cloudinaryId,
                    });
                }
            }
        }

        // 3️⃣ Upload Video Files
        let uploadedVideos = [];
        const videoArray = typeof videoFiles === 'string' ? JSON.parse(videoFiles) : videoFiles;
        if (Array.isArray(videoArray)) {
            for (const vid of videoArray) {
                const result = await uploadIfExists(vid, 'project-videos', 'video');
                if (result) {
                    uploadedVideos.push({
                        original: vid,
                        url: result.url,
                        cloudinaryId: result.cloudinaryId,
                    });
                }
            }
        }

        // 4️⃣ Prepare Final Project JSON
        const projectJSON = {
            id,
            title,
            description,
            mainImage: mainImageCloud?.url || null,
            imageFiles: uploadedImages.map(i => i.url),
            videoFiles: uploadedVideos.map(v => v.url),
            hashtags,
            githubLink,
        };

        const savePath = path.join(__dirname, '../public/project.json');
        fs.writeFileSync(savePath, JSON.stringify(projectJSON, null, 2), 'utf-8');

        // 5️⃣ Save to DB
        const resultId = await Project.create({
            id,
            title,
            description,
            mainImage: projectJSON.mainImage,
            imageFiles: JSON.stringify(projectJSON.imageFiles),
            videoFiles: JSON.stringify(projectJSON.videoFiles),
            hashtags,
            githubLink,
        });

        // 6️⃣ Optional: Clean project.json
        CleanJSON(projectJSON.id);

        return res.status(201).json({
            success: true,
            resultId,
            uploaded: {
                mainImage: projectJSON.mainImage,
                imageFiles: projectJSON.imageFiles,
                videoFiles: projectJSON.videoFiles,
            },
            message: '✅ Project saved and uploaded successfully.',
        });
    } catch (err) {
        console.error('❌ Error saving project:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
};


exports.UploadProjectAssetsFromJSON = async (req, res) => {
    try {
        const { json } = req.body;
        if (!json) return res.status(400).json({ error: 'Missing JSON content' });

        const parsed = typeof json === 'string' ? JSON.parse(json) : json;

        const imageNames = [];
        const videoNames = [];

        JSON.stringify(parsed).replace(/\/upload\/([^"']+)/g, (_, filename) => {
            if (/\.(png|jpg|jpeg|gif|webp)$/i.test(filename)) imageNames.push(filename);
            if (/\.(mp4|webm|mov)$/i.test(filename)) videoNames.push(filename);
        });

        res.json({ imageNames, videoNames });
    } catch (err) {
        console.error('❌ Error extracting assets:', err);
        res.status(500).json({ error: 'Failed to parse JSON content' });
    }
};

exports.GetProjects = async (req, res) => {
    try {
        const rows = await Project.findAll();
        res.json({ success: true, projects: rows });
    } catch (err) {
        console.error('❌ Error fetching projects:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.GetOneProject = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'Invalid ID' });

        const item = await Project.findById(id);
        if (!item) return res.status(404).json({ error: 'Project not found' });

        res.json({ success: true, project: item });
    } catch (err) {
        console.error('❌ Error fetching project:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.GetProjectJSON = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'Invalid ID' });

        const projectsDir = path.join(__dirname, '../public/upload/project');
        const jsonPath = path.join(projectsDir, `project-${id}.json`);

        // ✅ Step 1: If JSON file exists, serve from it
        if (fs.existsSync(jsonPath)) {
            const fileData = fs.readFileSync(jsonPath, 'utf-8');
            const parsedProject = JSON.parse(fileData);
            console.log(`📄 Served from project JSON: project-${id}.json`);
            return res.status(200).json({ success: true, project: parsedProject });
        }

        // 🔄 Step 2: Fallback to DB if file doesn't exist
        console.log("📦 Fetching project from DB...");
        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const parsedImageFiles = typeof project.imageFiles === 'string'
            ? JSON.parse(project.imageFiles)
            : project.imageFiles;

        const parsedVideoFiles = typeof project.videoFiles === 'string'
            ? JSON.parse(project.videoFiles)
            : project.videoFiles;

        const projectJSON = {
            id: project.id,
            title: project.title,
            description: project.description,
            mainImage: project.mainImage,
            imageFiles: parsedImageFiles || [],
            videoFiles: parsedVideoFiles || [],
            hashtags: project.hashtags,
            githubLink: project.githubLink
        };

        // ✏️ Create directory if needed and write file
        if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });
        fs.writeFileSync(jsonPath, JSON.stringify(projectJSON, null, 2), 'utf-8');
        console.log(`✅ Created project JSON: project-${id}.json`);

        return res.status(200).json({ success: true, project: projectJSON });

    } catch (err) {
        console.error('❌ Error fetching project:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
};


exports.DeleteProject = async (req, res) => {
    try {
        const id = parseInt(req.body.id);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, error: 'Invalid ID' });
        }

        const success = await Project.deleteById(id);
        if (!success) {
            return res.status(404).json({ success: false, error: 'Project not found or not deleted' });
        }

        res.json({ success: true, message: 'Project deleted' });
    } catch (err) {
        console.error('❌ Error deleting project:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.PutProject = async (req, res) => {
    try {
        const {
            id,
            title,
            description,
            mainImage,
            imageFiles,
            videoFiles,
            hashtags,
            githubLink,
        } = req.body;

        console.log('📦 Updating project with:', {
            id,
            title,
            description,
            mainImage,
            imageFiles,
            videoFiles,
            hashtags,
            githubLink,
        });

        if (!id || !title || !description) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const uploadDir = path.join(__dirname, '../public/upload/project');

        /**
         * Upload local file to Cloudinary
         * @param {string} fileName
         * @param {'project-main' | 'project-images' | 'project-videos'} folder
         * @param {'image' | 'video'} resourceType
         */
        const uploadIfExists = async (fileName, folder, resourceType = 'image') => {
            const fullPath = path.join(uploadDir, fileName);

            if (!fs.existsSync(fullPath)) {
                console.warn(`⚠️ File not found: ${fullPath}`);
                return null;
            }

            try {
                const result = await uploadToCloudinary(fullPath, { resource_type: resourceType }, folder);
                console.log(result, "upload cloudinary result")
                fs.unlinkSync(fullPath); // Clean up
                return {
                    url: result.url,
                    cloudinaryId: result.public_id,
                };
            } catch (err) {
                console.error(`❌ Upload failed [${resourceType}]:`, fileName, err.message);
                return null;
            }
        };

        // 1️⃣ Upload main image if it's a local file
        let mainImageCloud = null;
        if (mainImage && typeof mainImage === 'string' && !mainImage.startsWith('https://res.cloudinary.com/')) {
            mainImageCloud = await uploadIfExists(mainImage, 'project-main', 'image');
        }

        // 2️⃣ Process imageFiles array
        const imageArray = typeof imageFiles === 'string' ? JSON.parse(imageFiles) : imageFiles;
        const uploadedImages = [];

        if (Array.isArray(imageArray)) {
            for (const img of imageArray) {
                if (typeof img !== 'string' || img.trim() === '') continue;

                if (img.startsWith('https://res.cloudinary.com/')) {
                    uploadedImages.push(img); // ✅ push flat string
                } else {
                    const result = await uploadIfExists(img, 'project-images', 'image');
                    console.log(result?.url, "upload result")
                    if (result?.url) {
                        uploadedImages.push(result?.url);
                    } else {
                        console.warn(`⚠️ Skipped invalid or missing image: ${img}`);
                    }
                }
            }
        }

        // 3️⃣ Process videoFiles array
        const videoArray = typeof videoFiles === 'string' ? JSON.parse(videoFiles) : videoFiles;
        const uploadedVideos = [];

        if (Array.isArray(videoArray)) {
            for (const vid of videoArray) {
                if (typeof vid !== 'string' || vid.trim() === '') continue;

                if (vid.startsWith('https://res.cloudinary.com/')) {
                    uploadedVideos.push(vid); // ✅ push flat string
                } else {
                    const result = await uploadIfExists(vid, 'project-videos', 'video');
                    if (result?.url) {
                        uploadedVideos.push(result?.url);
                    } else {
                        console.warn(`⚠️ Skipped invalid or missing video: ${vid}`);
                    }
                }
            }
        }

        console.log(uploadedImages, uploadedVideos, "all updated media datas!!!!!!!!!!!")
        // 4️⃣ Compose project data
        const projectJSON = {
            id,
            title,
            description,
            mainImage: mainImageCloud?.url || (mainImage.startsWith('https://res.cloudinary.com/') ? mainImage : null),
            imageFiles: uploadedImages,
            videoFiles: uploadedVideos,
            hashtags,
            githubLink,
        };

        // Optional debug
        console.log('✅ Final media to save:', {
            mainImage: projectJSON.mainImage,
            imageFiles: projectJSON.imageFiles,
            videoFiles: projectJSON.videoFiles,
        });

        const savePath = path.join(__dirname, '../public/project.json');
        fs.writeFileSync(savePath, JSON.stringify(projectJSON, null, 2), 'utf-8');

        // 5️⃣ Update DB
        const success = await Project.updateById(id, {
            title,
            description,
            mainImage: projectJSON.mainImage,
            imageFiles: JSON.stringify(projectJSON.imageFiles),
            videoFiles: JSON.stringify(projectJSON.videoFiles),
            hashtags,
            githubLink,
        });

        if (!success) {
            return res.status(404).json({ error: 'Project not found' });
        }

        CleanJSON(projectJSON.id);

        return res.json({
            success: true,
            updated: {
                mainImage: projectJSON.mainImage,
                imageFiles: projectJSON.imageFiles,
                videoFiles: projectJSON.videoFiles,
            },
            message: '✅ Project updated and media uploaded.',
        });

    } catch (err) {
        console.error('❌ Error updating project:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};
