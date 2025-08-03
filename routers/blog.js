const express = require('express');
const { PostBlog, GetBlogJSON, SaveJSON, UploadBlogImage, GetBlog, GetOneBlog, DeleteBlog, DownloadImageBundle, PutBlog } = require('../controller/blog');
const blogRouter = express.Router();



blogRouter.post("/save", express.json(), PostBlog)
blogRouter.post("/saveJSON", express.json(), SaveJSON)
blogRouter.post("/upload", UploadBlogImage)
blogRouter.get("/get", express.json(), GetBlog)
blogRouter.get("/getJSON/:id", express.json(), GetBlogJSON)
blogRouter.get("/getOne/:slug", express.json(), GetOneBlog)
blogRouter.get("/delete/:id", express.json(), DeleteBlog)
blogRouter.get("/download/:slug", DownloadImageBundle);
blogRouter.put("/update/:id", express.json(), PutBlog); // Reusing PostBlog for updates

module.exports = blogRouter
