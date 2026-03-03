const { pool } = require('../config/db');

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
