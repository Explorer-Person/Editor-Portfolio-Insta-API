// db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Fatih.1905',
    database: 'Main_DB'
});

module.exports = pool;
