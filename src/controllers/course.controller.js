const { pool } = require('../config/db');

// @desc    Create a new course (Admin only)
const createCourse = async (req, res) => {
    try {
        const { title, description, price, video_url } = req.body;

        if (!title || price === undefined) {
            return res.status(400).json({ message: 'Title and price are required.' });
        }

        const result = await pool.query(
            'INSERT INTO courses (title, description, price, video_url) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, description, price, video_url]
        );

        res.status(201).json({
            message: 'Course created successfully',
            course: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error creating course.' });
    }
};

// @desc    Get all courses (Public)
const listCourses = async (req, res) => {
    try {
        // Exclude video_url for public listing, include offer details
        const result = await pool.query(
            'SELECT id, title, description, price, offer_price, offer_start_time, offer_end_time, created_at FROM courses ORDER BY created_at DESC'
        );

        res.json({ courses: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching courses.' });
    }
};

// @desc    Get specific course content (Protected: Admin or Purchased Student)
const getCourseContent = async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;

        // If not admin, verify purchase
        if (userRole !== 'admin') {
            const purchaseCheck = await pool.query(
                `SELECT * FROM purchases 
                 WHERE user_id = $1 AND course_id = $2 AND status = 'completed'`,
                [userId, courseId]
            );

            if (purchaseCheck.rows.length === 0) {
                return res.status(403).json({ message: 'Access denied. You have not purchased this course.' });
            }
        }

        // Fetch course with video_url
        const result = await pool.query('SELECT * FROM courses WHERE id = $1', [courseId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Course not found.' });
        }

        res.json({ course: result.rows[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching course content.' });
    }
};

// @desc    Update course (Admin only)
const updateCourse = async (req, res) => {
    try {
        const courseId = req.params.id;
        const { title, description, price, video_url } = req.body;

        const result = await pool.query(
            `UPDATE courses 
             SET title = COALESCE($1, title), 
                 description = COALESCE($2, description), 
                 price = COALESCE($3, price), 
                 video_url = COALESCE($4, video_url) 
             WHERE id = $5 RETURNING *`,
            [title, description, price, video_url, courseId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Course not found.' });
        }

        res.json({
            message: 'Course updated successfully',
            course: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error updating course.' });
    }
};

// @desc    Get all users for Admin Panel (Admin only)
const getAdminUsers = async (req, res) => {
    try {
        // Exclude passwords
        const result = await pool.query(
            "SELECT id, name, email, role, created_at FROM users WHERE role = 'student' ORDER BY created_at DESC"
        );
        res.json({ users: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching students.' });
    }
};

// @desc    Get all purchases / revenue for Admin Panel (Admin only)
const getAdminPurchases = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.id, p.status, p.created_at, u.name as student_name, u.email as student_email, c.title as course_title, c.price 
             FROM purchases p 
             JOIN users u ON p.user_id = u.id 
             JOIN courses c ON p.course_id = c.id 
             ORDER BY p.created_at DESC`
        );

        // Calculate total successful revenue
        const revenueResult = await pool.query(
            `SELECT SUM(c.price) as total_revenue
             FROM purchases p
             JOIN courses c ON p.course_id = c.id
             WHERE p.status = 'completed'`
        );

        res.json({
            purchases: result.rows,
            totalRevenue: revenueResult.rows[0].total_revenue || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching revenue details.' });
    }
};

// @desc    Delete course (Admin only)
const deleteCourse = async (req, res) => {
    try {
        const courseId = req.params.id;

        const result = await pool.query('DELETE FROM courses WHERE id = $1 RETURNING id', [courseId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Course not found.' });
        }

        res.json({ message: 'Course deleted successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error deleting course.' });
    }
};

module.exports = {
    createCourse,
    listCourses,
    getCourseContent,
    updateCourse,
    deleteCourse,
    getAdminUsers,
    getAdminPurchases
};
