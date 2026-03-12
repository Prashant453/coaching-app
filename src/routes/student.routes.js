const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/student.controller');

router.get('/dashboard-summary', authenticateToken, ctrl.getDashboardSummary);
router.get('/banners', ctrl.getBanners);
router.get('/batches', authenticateToken, ctrl.getMyBatches);
router.get('/lectures/:batchId', authenticateToken, ctrl.getLectures);
router.get('/assignments', authenticateToken, ctrl.getAssignments);
router.post('/assignments/:id/submit', authenticateToken, ctrl.submitAssignment);
router.get('/tests', authenticateToken, ctrl.getTests);
router.get('/payments', authenticateToken, ctrl.getPayments);
router.get('/events', ctrl.getEvents);
router.get('/doubts', authenticateToken, ctrl.getDoubts);
router.post('/doubts', authenticateToken, ctrl.askDoubt);
router.get('/performance', authenticateToken, ctrl.getPerformance);
router.get('/notifications', authenticateToken, ctrl.getNotifications);
router.put('/notifications/read', authenticateToken, ctrl.markNotificationsRead);
router.put('/fcm-token', authenticateToken, ctrl.updateFcmToken);
router.post('/checkout/apply-coupon', authenticateToken, ctrl.applyCoupon);

module.exports = router;
