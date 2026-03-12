const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/admin.controller');

// All routes require admin auth
router.use(authenticateToken, requireAdmin);

// Batches
router.get('/batches', ctrl.listBatches);

// Lectures CRUD
router.get('/lectures', ctrl.listLectures);
router.post('/lectures', ctrl.createLecture);
router.put('/lectures/:id', ctrl.updateLecture);
router.delete('/lectures/:id', ctrl.deleteLecture);

// App Version
router.put('/app-version', ctrl.updateAppVersion);

// Courses Extra
router.put('/courses/:id/offer', ctrl.updateCourseOffer);

// Coupons CRUD
router.get('/coupons', ctrl.listCoupons);
router.post('/coupons', ctrl.createCoupon);
router.delete('/coupons/:id', ctrl.deleteCoupon);

// Enrollments
router.post('/enrollments/grant', ctrl.grantAccess);

// Notifications
router.post('/notifications/send', ctrl.sendNotification);

module.exports = router;
