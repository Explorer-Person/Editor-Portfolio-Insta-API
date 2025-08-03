// model/blog.js
const db = require('../db/db');
const fs = require('fs');
const path = require('path');

const content = {
    init: async () => {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS contents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                link LONGTEXT NOT NULL,
                type VARCHAR(255) NOT NULL,
                postURL LONGTEXT NOT NULL,
                img_index INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table "contents" is ready.');
    },

    create: async (element, index) => {
        const [result] = await db.execute(
            `INSERT INTO contents (link, type, postURL, img_index)
                VALUES (?, ?, ?, ?)`,
            [element.link, element.type, element.postURL, element.img_index]
        );
        return result.insertId;
    },

    findAll: async () => {
        const [rows] = await db.execute(`SELECT * FROM contents ORDER BY id DESC`);
        return rows;
    },

    findById: async (id) => {
        console.log(id)
        const [rows] = await db.execute(`SELECT * FROM contents WHERE id = ? LIMIT 1`, [id]);
        return rows[0];
    },

    deleteAll: async () =>{
        const [rows] = await db.execute("DELETE FROM contents");
        return rows[0];
    }

};

module.exports = content;
