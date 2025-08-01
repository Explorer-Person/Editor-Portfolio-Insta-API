const Project = require('../model/project');
const fs = require('fs');
const path = require('path');

const multer = require('multer');


// 🛠 Setup Multer storage dynamically based on fieldname
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let folder = 'upload/others'; // default

        if (file.fieldname === 'imageFiles') folder = 'upload/imageFiles';
        if (file.fieldname === 'videoFiles') folder = 'upload/videoFiles';
        if (file.fieldname === 'mainImage') folder = 'upload/mainImage';

        const dir = path.join(process.cwd(), 'public', folder);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage }).fields([
    { name: 'imageFiles', maxCount: 50 },
    { name: 'videoFiles', maxCount: 20 },
    { name: 'mainImage', maxCount: 1 },
]);

exports.UploadProjectMedia = (req, res) => {
    upload(req, res, err => {
        if (err) {
            console.error('❌ Upload error:', err);
            return res.status(500).json({ success: false, error: 'Upload failed' });
        }

        const uploaded = {
            imageFiles: (req.files?.imageFiles || []).map(f => f.originalname),
            videoFiles: (req.files?.videoFiles || []).map(f => f.originalname),
            mainImage: (req.files?.mainImage || []).map(f => f.originalname),
        };

        console.log('✅ Uploaded media:', uploaded);
        return res.json({ success: true, uploaded });
    });
};

exports.PostProject = async (req, res) => {
    try {
        const { id, title, description, mainImage, imageFiles, videoFiles, hashtags, githubLink } = req.body;

        if (!title || !description) {
            return res.status(400).json({ error: 'Title and description are required' });
        }

        const resultId = await Project.create({
            id,
            title,
            description,
            mainImage,
            imageFiles,
            videoFiles,
            hashtags,
            githubLink
        });

        res.status(201).json({ success: true, resultId });
    } catch (err) {
        console.error('❌ Error saving project:', err);
        res.status(500).json({ success: false, error: err.message });
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
            githubLink
        } = req.body;
        console.log('Updating project with data:', {
            id,
            title,
            description,
            mainImage,
            imageFiles,
            videoFiles,
            hashtags,
            githubLink
        });

        if (!id || !title || !description) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const success = await Project.updateById(id, {
            title,
            description,
            mainImage,
            imageFiles,
            videoFiles,
            hashtags,
            githubLink
        });

        if (!success) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('❌ Error updating project:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};
