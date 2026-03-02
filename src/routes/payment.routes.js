const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment } = require('../controllers/payment.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// @route   POST /api/payments/create-order
// @desc    Initiate Razorpay order for a course
// @access  Private (Student)
router.post('/create-order', authenticateToken, createOrder);

// @route   POST /api/payments/verify
// @desc    Verify payment signature and grant course access
// @access  Private (Student)
router.post('/verify', authenticateToken, verifyPayment);

module.exports = router;
