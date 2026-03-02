const express = require('express');
const router = express.Router();
const {
    createCourse,
    listCourses,
    getCourseContent,
    updateCourse,
    deleteCourse,
    getAdminUsers,
    getAdminPurchases
} = require('../controllers/course.controller');
const { authenticateToken, requireAdmin } = require('../middleware/auth.middleware');

// @route   GET /api/courses
// @desc    Get all courses (public view)
// @access  Public
router.get('/', listCourses);

// @route   GET /api/courses/admin/users
// @desc    Get all users (Admin)
// @access  Private/Admin
router.get('/admin/users', authenticateToken, requireAdmin, getAdminUsers);

// @route   GET /api/courses/admin/purchases
// @desc    Get all purchases and revenue (Admin)
// @access  Private/Admin
router.get('/admin/purchases', authenticateToken, requireAdmin, getAdminPurchases);

// @route   POST /api/courses
// @desc    Create a new course
// @access  Private/Admin
router.post('/', authenticateToken, requireAdmin, createCourse);

// @route   GET /api/courses/:id/content
// @desc    Get full course content including video
// @access  Private (Purchased User or Admin)
router.get('/:id/content', authenticateToken, getCourseContent);

// @route   PUT /api/courses/:id
// @desc    Update course details
// @access  Private/Admin
router.put('/:id', authenticateToken, requireAdmin, updateCourse);

// @route   DELETE /api/courses/:id
// @desc    Delete course
// @access  Private/Admin
router.delete('/:id', authenticateToken, requireAdmin, deleteCourse);

module.exports = router;
