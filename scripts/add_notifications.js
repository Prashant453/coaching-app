const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Creating notifications table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'general',
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        `);
        console.log('Notifications table created successfully.');

        const users = await pool.query("SELECT id FROM users WHERE role = 'student'");

        for (let user of users.rows) {
            await pool.query(`
                INSERT INTO notifications (user_id, title, description, type, created_at)
                VALUES 
                ($1, 'Welcome to CoachPro', 'Thanks for joining. Start exploring your courses and batches!', 'general', NOW() - INTERVAL '2 days'),
                ($1, 'Upcoming Physics Test', 'Your Unit Test 3 for Physics is scheduled for tomorrow at 10 AM.', 'test', NOW() - INTERVAL '1 day'),
                ($1, 'Fee Reminder', 'Your second installment of Rs. 5000 is due next week.', 'fee', NOW())
            `, [user.id]);
        }
        console.log('Seeded notifications for existing students.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
