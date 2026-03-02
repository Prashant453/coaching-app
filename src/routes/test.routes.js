const express = require('express');
const router = express.Router();
const {
    createTest,
    addQuestions,
    getTestsForCourse,
    startTest,
    submitTest
} = require('../controllers/test.controller');
const { authenticateToken, requireAdmin } = require('../middleware/auth.middleware');

// @route   POST /api/tests
// @desc    Create a new test
// @access  Private/Admin
router.post('/', authenticateToken, requireAdmin, createTest);

// @route   POST /api/tests/:id/questions
// @desc    Add questions to test
// @access  Private/Admin
router.post('/:id/questions', authenticateToken, requireAdmin, addQuestions);

// @route   GET /api/tests/course/:courseId
// @desc    Get all tests for a course
// @access  Public (or semi-public view)
router.get('/course/:courseId', getTestsForCourse);

// @route   GET /api/tests/:id/start
// @desc    Start test and get questions (hides answers)
// @access  Private (Student with Course Access)
router.get('/:id/start', authenticateToken, startTest);

// @route   POST /api/tests/:id/submit
// @desc    Submit test and get calculated score
// @access  Private (Student)
router.post('/:id/submit', authenticateToken, submitTest);

module.exports = router;
