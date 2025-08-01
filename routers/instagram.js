// routes/Project.js
const express = require('express');
const {
    InstaContentSaver,
    GetInstaContents,
    GetInstaMediaByID
} = require('../controller/instagram');

const instaRouter = express.Router();


instaRouter.get("/savetodb", InstaContentSaver);
instaRouter.get("/getfromdb", GetInstaContents);
instaRouter.get("/media/:id", GetInstaMediaByID);


module.exports = instaRouter;