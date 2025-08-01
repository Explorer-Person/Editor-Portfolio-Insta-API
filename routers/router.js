const express = require('express');
const router = express.Router();
const blogRouter = require('./blog')
const projectRouter = require('./project')
const instaRouter = require('./instagram')


router.use("/blog", blogRouter)
router.use("/project", projectRouter)
router.use("/instagram", instaRouter)
router.get('/test', (req, res) => {
    res.status(200).json({
        success: true,
        message: '🚀 API is working!',
        time: new Date().toISOString()
    });
});

module.exports = router
