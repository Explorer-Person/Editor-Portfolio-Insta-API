// initDB.js
const mysql = require('mysql2/promise');

const dbName = process.env.DB_NAME;

async function initializeDatabase() {
    // Step 1: Connect without a specific database
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST, 
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT
    });

    // Step 2: Create the database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database "${dbName}" is ready.`);

    await connection.end();
}

module.exports = initializeDatabase;
