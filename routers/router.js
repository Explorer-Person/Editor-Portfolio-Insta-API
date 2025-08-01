const express = require('express');
const router = express.Router();
const blogRouter = require('./blog')
const projectRouter = require('./project')
const instaRouter = require('./instagram')


router.use("/blog", blogRouter)
router.use("/project", projectRouter)
router.use("/instagram", instaRouter)

module.exports = router
