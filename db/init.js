// initDB.js
const mysql = require('mysql2/promise');

const dbName = 'Main_DB';

async function initializeDatabase() {
    // Step 1: Connect without a specific database
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Fatih.1905'
    });

    // Step 2: Create the database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database "${dbName}" is ready.`);

    await connection.end();
}

module.exports = initializeDatabase;
