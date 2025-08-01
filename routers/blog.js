const express = require('express');
const { PostBlog, UploadBlogImagesFromJSON, GetBlog, GetOneBlog, DeleteBlog, DownloadImageBundle, PutBlog } = require('../controller/blog');
const blogRouter = express.Router();



blogRouter.post("/save", PostBlog)
blogRouter.post("/upload", UploadBlogImagesFromJSON)
blogRouter.get("/get", express.json(), GetBlog)
blogRouter.get("/getOne/:slug", express.json(), GetOneBlog)
blogRouter.get("/delete/:slug", express.json(), DeleteBlog)
blogRouter.get("/download/:slug", DownloadImageBundle);
blogRouter.put("/update/:id", PutBlog); // Reusing PostBlog for updates

module.exports = blogRouter
