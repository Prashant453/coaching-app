const { pool } = require('../config/db');
const { sendPushNotification } = require('../config/firebase');

// GET /api/admin/lectures?batch_id=xxx
exports.listLectures = async (req, res) => {
    try {
        const { batch_id } = req.query;
        let query = `SELECT l.*, b.name as batch_name FROM lectures l
                     LEFT JOIN batches b ON l.batch_id = b.id`;
        const params = [];
        if (batch_id) {
            query += ' WHERE l.batch_id = $1';
            params.push(batch_id);
        }
        query += ' ORDER BY l.scheduled_time DESC';
        const result = await pool.query(query, params);
        res.json({ lectures: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/admin/lectures
exports.createLecture = async (req, res) => {
    try {
        const { batch_id, title, description, video_url, thumbnail_url, is_live, scheduled_time, duration_minutes } = req.body;
        if (!batch_id || !title) {
            return res.status(400).json({ message: 'batch_id and title are required' });
        }
        const result = await pool.query(
            `INSERT INTO lectures (batch_id, title, description, video_url, thumbnail_url, is_live, scheduled_time, duration_minutes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [batch_id, title, description || null, video_url || null, thumbnail_url || null, is_live || false, scheduled_time || null, duration_minutes || 60]
        );
        res.status(201).json({ message: 'Lecture created', lecture: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// PUT /api/admin/lectures/:id
exports.updateLecture = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, video_url, thumbnail_url, is_live, scheduled_time, duration_minutes } = req.body;
        const result = await pool.query(
            `UPDATE lectures SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                video_url = $3,
                thumbnail_url = $4,
                is_live = COALESCE($5, is_live),
                scheduled_time = COALESCE($6, scheduled_time),
                duration_minutes = COALESCE($7, duration_minutes)
             WHERE id = $8 RETURNING *`,
            [title, description, video_url, thumbnail_url, is_live, scheduled_time, duration_minutes, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Lecture not found' });
        res.json({ message: 'Lecture updated', lecture: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// DELETE /api/admin/lectures/:id
exports.deleteLecture = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM lectures WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Lecture not found' });
        res.json({ message: 'Lecture deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/admin/batches — list all batches for dropdown
exports.listBatches = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT b.id, b.name, c.title as course_title FROM batches b
             LEFT JOIN courses c ON b.course_id = c.id ORDER BY b.name`
        );
        res.json({ batches: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/app-version — public, no auth needed
exports.getAppVersion = async (req, res) => {
    try {
        // Check if app_settings table exists with version info
        const result = await pool.query(
            `SELECT * FROM app_settings WHERE key = 'app_version' LIMIT 1`
        );
        if (result.rows.length > 0) {
            const settings = JSON.parse(result.rows[0].value);
            return res.json(settings);
        }
        // Default fallback
        res.json({
            latest_version: '1.0.0',
            min_version: '1.0.0',
            update_url: '',
            release_notes: 'Initial release',
            is_mandatory: false
        });
    } catch (err) {
        // Table might not exist yet, return defaults
        res.json({
            latest_version: '1.0.0',
            min_version: '1.0.0',
            update_url: '',
            release_notes: 'Initial release',
            is_mandatory: false
        });
    }
};

// PUT /api/admin/app-version — admin sets version info
exports.updateAppVersion = async (req, res) => {
    try {
        const { latest_version, min_version, update_url, release_notes, is_mandatory } = req.body;
        const value = JSON.stringify({ latest_version, min_version, update_url, release_notes, is_mandatory });
        await pool.query(
            `INSERT INTO app_settings (key, value) VALUES ('app_version', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [value]
        );
        res.json({ message: 'App version updated', version: JSON.parse(value) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};
// PUT /api/admin/courses/:id/offer
exports.updateCourseOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const { offer_price, offer_start_time, offer_end_time } = req.body;

        const result = await pool.query(
            `UPDATE courses SET 
                offer_price = $1, 
                offer_start_time = $2, 
                offer_end_time = $3 
             WHERE id = $4 RETURNING *`,
            [offer_price || null, offer_start_time || null, offer_end_time || null, id]
        );

        if (result.rows.length === 0) return res.status(404).json({ message: 'Course not found' });
        res.json({ message: 'Course offer updated', course: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error updating course offer' });
    }
};

// --- COUPON MANAGEMENT ---

// GET /api/admin/coupons
exports.listCoupons = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, co.title as course_title 
            FROM coupons c
            LEFT JOIN courses co ON c.course_id = co.id 
            ORDER BY c.created_at DESC
        `);
        res.json({ coupons: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error listing coupons' });
    }
};

// POST /api/admin/coupons
exports.createCoupon = async (req, res) => {
    try {
        const { code, discount_type, discount_value, max_usage, course_id, expiry_date } = req.body;
        if (!code || !discount_type || discount_value === undefined) {
            return res.status(400).json({ message: 'Code, discount type, and value are required' });
        }

        const result = await pool.query(
            `INSERT INTO coupons (code, discount_type, discount_value, max_usage, course_id, expiry_date)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [code.toUpperCase(), discount_type, discount_value, max_usage || 100, course_id || null, expiry_date || null]
        );
        res.status(201).json({ message: 'Coupon created', coupon: result.rows[0] });
    } catch (err) {
        console.error(err);
        if (err.constraint === 'coupons_code_key') {
            return res.status(400).json({ message: 'Coupon code already exists' });
        }
        res.status(500).json({ message: 'Server error creating coupon' });
    }
};

// DELETE /api/admin/coupons/:id
exports.deleteCoupon = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM coupons WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Coupon not found' });
        res.json({ message: 'Coupon deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error deleting coupon' });
    }
};

// --- ACCESS MANAGEMENT ---

// POST /api/admin/enrollments/grant
exports.grantAccess = async (req, res) => {
    try {
        const { user_email, course_id } = req.body;
        if (!user_email || !course_id) {
            return res.status(400).json({ message: 'User email and course ID are required' });
        }

        // Find user
        const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [user_email]);
        if (userRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        const studentId = userRes.rows[0].id;

        // Check if already purchased/granted
        const checkRes = await pool.query('SELECT id FROM purchases WHERE user_id = $1 AND course_id = $2', [studentId, course_id]);
        if (checkRes.rows.length > 0) {
            return res.status(400).json({ message: 'User already has access to this course' });
        }

        // Grant access in purchases table
        await pool.query(
            `INSERT INTO purchases (user_id, course_id, status, access_type, granted_by_admin)
             VALUES ($1, $2, 'completed', 'admin_granted', $3)`,
            [studentId, course_id, req.user.id]
        );

        // Fetch batches for this course to auto-enroll
        const batchesRes = await pool.query('SELECT id FROM batches WHERE course_id = $1', [course_id]);
        for (let b of batchesRes.rows) {
            await pool.query(
                `INSERT INTO enrollments (user_id, batch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [studentId, b.id]
            );
        }

        res.json({ message: 'Access granted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error granting access' });
    }
};

// --- NOTIFICATIONS ---

// POST /api/admin/notifications/send
exports.sendNotification = async (req, res) => {
    try {
        const { title, description, type, target, specific_user_email } = req.body;
        // target could be 'all', 'unenrolled', 'specific'

        if (!title || !description || !target) {
            return res.status(400).json({ message: 'Title, description, and target are required' });
        }

        let userIds = [];

        if (target === 'specific' && specific_user_email) {
            const uRes = await pool.query('SELECT id FROM users WHERE email = $1', [specific_user_email]);
            if (uRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });
            userIds.push(uRes.rows[0].id);
        } else if (target === 'all') {
            const uRes = await pool.query('SELECT id FROM users WHERE role = $1', ['student']);
            userIds = uRes.rows.map(r => r.id);
        } else if (target === 'unenrolled') {
            const uRes = await pool.query(`
                SELECT id FROM users 
                WHERE role = 'student' 
                AND id NOT IN (SELECT user_id FROM purchases WHERE status = 'completed')
            `);
            userIds = uRes.rows.map(r => r.id);
        }

        if (userIds.length === 0) {
            return res.status(400).json({ message: 'No users found for this target' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (let uid of userIds) {
                await client.query(
                    `INSERT INTO notifications (user_id, title, description, type) VALUES ($1, $2, $3, $4)`,
                    [uid, title, description, type || 'general']
                );
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        // Fetch FCM tokens for the selected users to send push notes
        if (userIds.length > 0) {
            const tokenRes = await pool.query(
                'SELECT fcm_token FROM users WHERE id = ANY($1) AND fcm_token IS NOT NULL',
                [userIds]
            );
            const tokens = tokenRes.rows.map(r => r.fcm_token);
            if (tokens.length > 0) {
                await sendPushNotification(tokens, title, description, { type: type || 'general' });
            }
        }

        res.json({ message: `Notification saved and push triggered for ${userIds.length} users` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error sending notification' });
    }
};
