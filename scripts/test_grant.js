require('dotenv').config();
const { pool } = require('../src/config/db');
const ctrl = require('../src/controllers/admin.controller');

async function testGrant() {
    // get a user and a course
    const u = await pool.query("SELECT id FROM users WHERE role='student' LIMIT 1");
    const c = await pool.query('SELECT id FROM courses LIMIT 1');
    const admin = await pool.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
    if(u.rows.length === 0 || c.rows.length === 0) return console.log('no user or course');
    const req = {
        body: { user_id: u.rows[0].id, course_id: c.rows[0].id },
        user: { id: admin.rows[0].id }
    };
    const res = {
        status: (code) => { console.log('Status:', code); return { json: (data) => console.log('JSON:', data) }; },
        json: (data) => console.log('JSON:', data)
    };
    await ctrl.grantAccess(req, res);
}

testGrant().then(() => process.exit()).catch(e => { console.error(e); process.exit(1); });
