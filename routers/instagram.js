// routes/Project.js
const express = require('express');
const {
    InstaContentSaver,
    GetInstaContents,
    GetInstaMediaByID,
    debuggingRoute
} = require('../controller/instagram');

const instaRouter = express.Router();


instaRouter.get("/savetodb", InstaContentSaver);
instaRouter.get("/getfromdb", GetInstaContents);
instaRouter.get("/media/:id", GetInstaMediaByID);
instaRouter.get("/debug/login", debuggingRoute)

module.exports = instaRouter;