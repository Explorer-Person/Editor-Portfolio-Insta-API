require("dotenv").config();
const express = require('express');
const cors = require('cors');

const helmet = require('helmet');
const router = require('./routers/router');
const initializeDatabase = require('./db/init');
const Blog = require('./model/blog');
const Project = require('./model/project'); // or './model/project' if named that
const path = require('path');
const cleanupImages = require('./middlewares/cleanup/middleware.js');
const serveIndex = require('serve-index');
const { downloadInstaDatas } = require('./controller/instagram.js');
const Content = require('./model/content.js');

const app = express();

cleanupImages;



// Middleware
app.use(cors());

// ✅ Static upload serving
// ✅ Serve uploads with CORS and cross-origin headers
app.use('/upload', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // allow use in <img>, <video>
    next();
});

// ✅ Serve static files from /public/upload
app.use('/upload', express.static(path.join(__dirname, 'public/upload')));

// ✅ Debug log
app.use((req, res, next) => {
    console.log(`[5000] ${req.method} ${req.url}`);
    next();
});


// ✅ Routes last (after middleware is configured)
app.use('/api', router);


// ✅ DB & Server boot
Blog.init();
Project.init(); // <- Add this line
Content.init();
initializeDatabase().then(() => {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`✅ Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error("❌ Failed to initialize DB:", err.message);
    process.exit(1);
});
