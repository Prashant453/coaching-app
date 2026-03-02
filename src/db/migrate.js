require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function initializeDatabase() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();

        try {
            console.log('Reading schema.sql...');
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');

            console.log('Executing schema...');
            await client.query(schemaSql);

            console.log('Database initialization successful! 🎉');

        } catch (err) {
            console.error('Error executing schema:', err);
        } finally {
            client.release();
        }

    } catch (err) {
        console.error('Database connection error:', err);
    } finally {
        await pool.end();
        process.exit();
    }
}

initializeDatabase();
