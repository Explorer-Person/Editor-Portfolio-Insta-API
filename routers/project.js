// routes/Project.js
const express = require('express');
const {
    PostProject,
    SaveJSON,
    GetProjectJSON,
    UploadProjectMedia,
    GetProjects,
    GetOneProject,
    DeleteProject,
    PutProject
} = require('../controller/project');

const projectRouter = express.Router();


projectRouter.post("/save", express.json(), PostProject);
projectRouter.post("/saveJSON", express.json(), SaveJSON);
projectRouter.post("/upload", UploadProjectMedia);
projectRouter.get("/get", express.json(), GetProjects);
projectRouter.get("/get/:id", express.json(), GetOneProject);
projectRouter.get("/getJSON/:id", express.json(), GetProjectJSON);
projectRouter.delete("/delete", express.json(), DeleteProject);
projectRouter.put("/update", express.json(), PutProject);

module.exports = projectRouter;
