const { pool } = require('../config/db');

// GET /api/student/dashboard-summary
exports.getDashboardSummary = async (req, res) => {
    try {
        const userId = req.user.id;
        const attendanceRes = await pool.query(
            `SELECT COUNT(*) FILTER (WHERE is_present = true) as present, COUNT(*) as total
             FROM attendance WHERE user_id = $1`, [userId]
        );
        const assignmentsRes = await pool.query(
            `SELECT COUNT(*) FILTER (WHERE a.id NOT IN (SELECT assignment_id FROM submissions WHERE user_id = $1)) as pending
             FROM assignments a
             INNER JOIN batches b ON a.batch_id = b.id
             INNER JOIN enrollments e ON e.batch_id = b.id AND e.user_id = $1`, [userId]
        );
        const testsRes = await pool.query(
            `SELECT COUNT(*) as upcoming FROM tests t
             INNER JOIN courses c ON t.course_id = c.id
             INNER JOIN batches b ON b.course_id = c.id
             INNER JOIN enrollments e ON e.batch_id = b.id AND e.user_id = $1
             WHERE t.scheduled_date > NOW()`, [userId]
        );
        const paymentsRes = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) as pending_amount FROM payments WHERE user_id = $1 AND status = 'pending'`, [userId]
        );

        const att = attendanceRes.rows[0];
        res.json({
            classes_attended: parseInt(att.present) || 0,
            total_classes: parseInt(att.total) || 0,
            pending_assignments: parseInt(assignmentsRes.rows[0].pending) || 0,
            upcoming_tests: parseInt(testsRes.rows[0].upcoming) || 0,
            pending_fees: parseFloat(paymentsRes.rows[0].pending_amount) || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/student/banners
exports.getBanners = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM banners WHERE is_active = true ORDER BY created_at DESC');
        res.json({ banners: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/student/batches
exports.getMyBatches = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT b.*, e.progress, e.enrolled_at, c.title as course_title
             FROM batches b
             INNER JOIN enrollments e ON e.batch_id = b.id
             INNER JOIN courses c ON b.course_id = c.id
             WHERE e.user_id = $1
             ORDER BY e.enrolled_at DESC`, [req.user.id]
        );
        res.json({ batches: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/student/lectures/:batchId
exports.getLectures = async (req, res) => {
    try {
        const { batchId } = req.params;
        const result = await pool.query(
            'SELECT * FROM lectures WHERE batch_id = $1 ORDER BY scheduled_time DESC', [batchId]
        );
        res.json({ lectures: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/student/assignments
exports.getAssignments = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            `SELECT a.*, b.name as batch_name,
                    s.id as submission_id, s.status as submission_status, s.marks as submission_marks, s.submitted_at
             FROM assignments a
             INNER JOIN batches b ON a.batch_id = b.id
             INNER JOIN enrollments e ON e.batch_id = b.id AND e.user_id = $1
             LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = $1
             ORDER BY a.due_date ASC`, [userId]
        );
        res.json({ assignments: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/student/assignments/:id/submit
exports.submitAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        await pool.query(
            `INSERT INTO submissions (assignment_id, user_id, status) VALUES ($1, $2, 'submitted')
             ON CONFLICT (assignment_id, user_id) DO UPDATE SET submitted_at = NOW()`, [id, userId]
        );
        res.json({ message: 'Assignment submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/student/tests
exports.getTests = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            `SELECT t.*, c.title as course_title,
                    tr.score, tr.total_marks as result_total, tr.rank, tr.submitted_at as result_date
             FROM tests t
             INNER JOIN courses c ON t.course_id = c.id
             INNER JOIN batches b ON b.course_id = c.id
             INNER JOIN enrollments e ON e.batch_id = b.id AND e.user_id = $1
             LEFT JOIN test_results tr ON tr.test_id = t.id AND tr.user_id = $1
             ORDER BY t.scheduled_date DESC`, [userId]
        );
        res.json({ tests: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/student/payments
exports.getPayments = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM payments WHERE user_id = $1 ORDER BY due_date ASC', [req.user.id]
        );
        const pending = result.rows.filter(p => p.status === 'pending');
        const paid = result.rows.filter(p => p.status === 'paid');
        res.json({ payments: result.rows, pending, paid });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/student/events
exports.getEvents = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM events WHERE event_date >= NOW() ORDER BY event_date ASC'
        );
        res.json({ events: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/student/doubts
exports.getDoubts = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM doubts WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]
        );
        res.json({ doubts: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/student/doubts
exports.askDoubt = async (req, res) => {
    try {
        const { subject, message } = req.body;
        const result = await pool.query(
            'INSERT INTO doubts (user_id, subject, message) VALUES ($1, $2, $3) RETURNING *',
            [req.user.id, subject, message]
        );
        res.json({ doubt: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/student/performance
exports.getPerformance = async (req, res) => {
    try {
        const userId = req.user.id;
        const testScores = await pool.query(
            `SELECT t.title, tr.score, tr.total_marks, tr.rank, tr.submitted_at
             FROM test_results tr
             INNER JOIN tests t ON tr.test_id = t.id
             WHERE tr.user_id = $1
             ORDER BY tr.submitted_at ASC`, [userId]
        );
        const attendance = await pool.query(
            `SELECT date, is_present FROM attendance WHERE user_id = $1 ORDER BY date ASC`, [userId]
        );
        const attSummary = await pool.query(
            `SELECT COUNT(*) FILTER (WHERE is_present) as present, COUNT(*) as total
             FROM attendance WHERE user_id = $1`, [userId]
        );
        const att = attSummary.rows[0];
        res.json({
            test_scores: testScores.rows,
            attendance: attendance.rows,
            attendance_percentage: att.total > 0 ? Math.round((att.present / att.total) * 100) : 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/student/notifications
exports.getNotifications = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]
        );
        res.json({ notifications: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// PUT /api/student/notifications/read
exports.markNotificationsRead = async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]
        );
        res.json({ message: 'Notifications marked as read' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// PUT /api/student/fcm-token
exports.updateFcmToken = async (req, res) => {
    try {
        const { fcm_token } = req.body;
        if (!fcm_token) return res.status(400).json({ message: 'Token is required' });

        await pool.query('UPDATE users SET fcm_token = $1 WHERE id = $2', [fcm_token, req.user.id]);
        res.json({ message: 'FCM token updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/student/checkout/apply-coupon
exports.applyCoupon = async (req, res) => {
    try {
        const { code, course_id } = req.body;
        if (!code || !course_id) return res.status(400).json({ message: 'Coupon code and course ID are required' });

        const couponRes = await pool.query(
            'SELECT * FROM coupons WHERE code = $1 AND (course_id IS NULL OR course_id = $2)',
            [code.toUpperCase(), course_id]
        );

        if (couponRes.rows.length === 0) return res.status(404).json({ message: 'Invalid or inapplicable coupon' });
        const coupon = couponRes.rows[0];

        // Check expiry
        if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
            return res.status(400).json({ message: 'Coupon has expired' });
        }
        // Check usage limits
        if (coupon.max_usage && coupon.current_usage >= coupon.max_usage) {
            return res.status(400).json({ message: 'Coupon usage limit reached' });
        }

        // Fetch course price to calculate discount mapping accurately
        const courseRes = await pool.query('SELECT price, offer_price, offer_start_time, offer_end_time FROM courses WHERE id = $1', [course_id]);
        if (courseRes.rows.length === 0) return res.status(404).json({ message: 'Course not found' });

        const course = courseRes.rows[0];
        let basePrice = Number(course.price);

        // Determine if an offer is currently active
        const now = new Date();
        const offerStart = course.offer_start_time ? new Date(course.offer_start_time) : null;
        const offerEnd = course.offer_end_time ? new Date(course.offer_end_time) : null;

        let isOfferActive = false;
        if (course.offer_price && offerStart && offerEnd) {
            if (now >= offerStart && now <= offerEnd) {
                basePrice = Number(course.offer_price);
                isOfferActive = true;
            }
        }

        let discountAmount = 0;
        if (coupon.discount_type === 'percent') {
            discountAmount = basePrice * (Number(coupon.discount_value) / 100);
        } else {
            discountAmount = Number(coupon.discount_value);
        }

        // Don't discount below 0
        if (discountAmount > basePrice) discountAmount = basePrice;

        const finalPrice = basePrice - discountAmount;

        res.json({
            message: 'Coupon applied',
            coupon_id: coupon.id,
            original_price: Number(course.price),
            base_computation_price: basePrice, // Includes ongoing offer price if active
            discount_amount: discountAmount,
            final_price: finalPrice,
            is_offer_active: isOfferActive
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error applying coupon' });
    }
};
