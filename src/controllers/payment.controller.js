const Razorpay = require('razorpay');
const crypto = require('crypto');
const { pool } = require('../config/db');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    Create Razorpay Order
// @access  Private (Student)
const createOrder = async (req, res) => {
    try {
        const { courseId } = req.body;
        const userId = req.user.id;

        if (!courseId) {
            return res.status(400).json({ message: 'Course ID is required.' });
        }

        // 1. Verify Course and get price
        const courseCheck = await pool.query('SELECT price FROM courses WHERE id = $1', [courseId]);
        if (courseCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Course not found.' });
        }

        const priceStr = courseCheck.rows[0].price;
        const amountInPaise = Math.round(parseFloat(priceStr) * 100);

        if (amountInPaise <= 0) {
            return res.status(400).json({ message: 'Invalid course price for payment.' });
        }

        // 2. Prevent duplicate purchases
        const duplicateCheck = await pool.query(
            "SELECT id FROM purchases WHERE user_id = $1 AND course_id = $2 AND status = 'completed'",
            [userId, courseId]
        );
        if (duplicateCheck.rows.length > 0) {
            return res.status(400).json({ message: 'You have already purchased this course.' });
        }

        // 3. Create Razorpay Order
        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `rcpt_${userId.substring(0, 8)}_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        // 4. Save to DB strictly as "pending"
        await pool.query(
            `INSERT INTO purchases (user_id, course_id, razorpay_order_id, status) 
             VALUES ($1, $2, $3, 'pending')
             ON CONFLICT (user_id, course_id) 
             DO UPDATE SET razorpay_order_id = EXCLUDED.razorpay_order_id, status = 'pending'`,
            [userId, courseId, order.id]
        );

        res.status(200).json({
            message: 'Order created successfully',
            orderId: order.id,
            amount: amountInPaise,
            currency: 'INR'
        });

    } catch (err) {
        console.error('Create Order Error:', err);
        res.status(500).json({ message: 'Failed to create payment order.' });
    }
};

// @desc    Verify Razorpay Payment Signature
// @access  Private (Student)
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: 'Missing payment verification details.' });
        }

        // 1. Verify Signature using HMAC SHA256
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            // Update status to failed
            await pool.query(
                "UPDATE purchases SET status = 'failed' WHERE razorpay_order_id = $1",
                [razorpay_order_id]
            );
            return res.status(400).json({ message: 'Invalid payment signature.' });
        }

        // 2. Mark Payment Complete
        const updateResult = await pool.query(
            `UPDATE purchases 
             SET razorpay_payment_id = $1, status = 'completed' 
             WHERE razorpay_order_id = $2 RETURNING id, course_id`,
            [razorpay_payment_id, razorpay_order_id]
        );

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ message: 'Order reference not found in database.' });
        }

        res.status(200).json({
            message: 'Payment verified successfully! Access granted.',
            purchaseId: updateResult.rows[0].id
        });

    } catch (err) {
        console.error('Verify Payment Error:', err);
        res.status(500).json({ message: 'Failed to verify payment.' });
    }
};

module.exports = {
    createOrder,
    verifyPayment
};
