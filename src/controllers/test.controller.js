const { pool } = require('../config/db');

// @desc    Create a new test (Admin only)
const createTest = async (req, res) => {
    try {
        const { course_id, title, duration_minutes } = req.body;

        if (!course_id || !title || !duration_minutes) {
            return res.status(400).json({ message: 'Course ID, title, and duration are required.' });
        }

        const result = await pool.query(
            'INSERT INTO tests (course_id, title, duration_minutes) VALUES ($1, $2, $3) RETURNING *',
            [course_id, title, duration_minutes]
        );

        res.status(201).json({
            message: 'Test created successfully',
            test: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error creating test.' });
    }
};

// @desc    Add questions to a test (Admin only)
const addQuestions = async (req, res) => {
    try {
        const testId = req.params.id;
        const { questions } = req.body; // Array of questions

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: 'Questions array is required.' });
        }

        // Using a transaction for bulk insert
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const insertedQuestions = [];
            for (let q of questions) {
                const { question_text, option_a, option_b, option_c, option_d, correct_option, marks } = q;
                const result = await client.query(
                    `INSERT INTO questions (test_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                    [testId, question_text, option_a, option_b, option_c, option_d, correct_option, marks || 1]
                );
                insertedQuestions.push(result.rows[0]);
            }

            await client.query('COMMIT');
            res.status(201).json({
                message: `${insertedQuestions.length} questions added successfully.`
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error adding questions.' });
    }
};

// @desc    Get tests for a specific course (Public/Student)
const getTestsForCourse = async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const result = await pool.query('SELECT * FROM tests WHERE course_id = $1 ORDER BY created_at ASC', [courseId]);

        res.json({ tests: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching tests.' });
    }
};

// @desc    Start Test and get questions (Protected: Student)
const startTest = async (req, res) => {
    try {
        const testId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;

        // 1. Get Test Info (and associated course)
        const testResult = await pool.query('SELECT * FROM tests WHERE id = $1', [testId]);
        if (testResult.rows.length === 0) {
            return res.status(404).json({ message: 'Test not found.' });
        }
        const test = testResult.rows[0];

        // 2. Access Control: If Student, check payment and previous submissions
        if (userRole !== 'admin') {
            // Check Purchase
            const purchaseCheck = await pool.query(
                `SELECT * FROM purchases WHERE user_id = $1 AND course_id = $2 AND status = 'completed'`,
                [userId, test.course_id]
            );
            if (purchaseCheck.rows.length === 0) {
                return res.status(403).json({ message: 'Access denied. You must purchase the course to take this test.' });
            }

            // Check if already attempted (Prevent reattempt)
            const submissionCheck = await pool.query(
                'SELECT id FROM test_results WHERE user_id = $1 AND test_id = $2',
                [userId, testId]
            );
            if (submissionCheck.rows.length > 0) {
                return res.status(403).json({ message: 'You have already submitted this test.' });
            }
        }

        // 3. Fetch Questions (Without answers and marks to prevent cheating)
        const questionsResult = await pool.query(
            `SELECT id, question_text, option_a, option_b, option_c, option_d 
             FROM questions WHERE test_id = $1`,
            [testId]
        );

        res.json({
            test: {
                id: test.id,
                title: test.title,
                duration_minutes: test.duration_minutes
            },
            questions: questionsResult.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error starting test.' });
    }
};

// @desc    Submit Test and calculate score (Protected: Student)
const submitTest = async (req, res) => {
    try {
        const testId = req.params.id;
        const userId = req.user.id;
        const { answers } = req.body; // Array: [{ question_id, selected_option }]

        if (!Array.isArray(answers)) {
            return res.status(400).json({ message: 'Answers array is required.' });
        }

        // 1. Prevent multiple submissions
        const submissionCheck = await pool.query(
            'SELECT id FROM test_results WHERE user_id = $1 AND test_id = $2',
            [userId, testId]
        );
        if (submissionCheck.rows.length > 0) {
            return res.status(403).json({ message: 'Test already submitted.' });
        }

        // 2. Fetch correct answers & calculate score
        const questionsResult = await pool.query(
            'SELECT id, correct_option, marks FROM questions WHERE test_id = $1',
            [testId]
        );

        const correctAnswers = questionsResult.rows;
        let score = 0;
        let totalMarks = 0;

        // Map correct answers for quick lookup
        const answerKey = {};
        correctAnswers.forEach(q => {
            answerKey[q.id] = { correct_option: q.correct_option, marks: q.marks };
            totalMarks += q.marks;
        });

        // Loop through student answers
        answers.forEach(studentAnswer => {
            const key = answerKey[studentAnswer.question_id];
            if (key && key.correct_option === studentAnswer.selected_option) {
                score += key.marks;
            }
        });

        // 3. Save Result
        await pool.query(
            'INSERT INTO test_results (user_id, test_id, score, total_marks) VALUES ($1, $2, $3, $4)',
            [userId, testId, score, totalMarks]
        );

        res.status(200).json({
            message: 'Test submitted successfully',
            score,
            totalMarks
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error submitting test.' });
    }
};


module.exports = {
    createTest,
    addQuestions,
    getTestsForCourse,
    startTest,
    submitTest
};
