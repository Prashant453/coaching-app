require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🌱 Starting seed...');
        await client.query('BEGIN');

        // 1. Demo Student
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('student123', salt);
        const studentRes = await client.query(
            `INSERT INTO users (name, email, password_hash, role, phone, class_name, batch_year)
             VALUES ('Prashant Kumar', 'prashant@student.com', $1, 'student', '9876543210', 'Class 12', '2026')
             ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`, [hash]
        );
        const studentId = studentRes.rows[0].id;
        console.log('✅ Demo student created');

        // 2. Courses
        const course1 = await client.query(
            `INSERT INTO courses (title, description, price) VALUES
             ('JEE Advanced 2026', 'Complete JEE Advanced preparation covering Physics, Chemistry, and Mathematics.', 25000)
             RETURNING id`
        );
        const course2 = await client.query(
            `INSERT INTO courses (title, description, price) VALUES
             ('NEET 2026 Crash Course', 'Intensive crash course for NEET with Biology, Chemistry, and Physics.', 18000)
             RETURNING id`
        );
        const courseId1 = course1.rows[0].id;
        const courseId2 = course2.rows[0].id;
        console.log('✅ Courses created');

        // 3. Batches
        const batch1 = await client.query(
            `INSERT INTO batches (course_id, name, faculty, timing, start_date, end_date, max_students) VALUES
             ($1, 'JEE Morning Batch', 'Dr. Ramesh Sharma', '8:00 AM - 11:00 AM', '2026-01-15', '2026-06-30', 50) RETURNING id`, [courseId1]
        );
        const batch2 = await client.query(
            `INSERT INTO batches (course_id, name, faculty, timing, start_date, end_date, max_students) VALUES
             ($1, 'NEET Evening Batch', 'Dr. Priya Patel', '4:00 PM - 7:00 PM', '2026-02-01', '2026-07-31', 45) RETURNING id`, [courseId2]
        );
        const batchId1 = batch1.rows[0].id;
        const batchId2 = batch2.rows[0].id;
        console.log('✅ Batches created');

        // 4. Enrollments
        await client.query(
            `INSERT INTO enrollments (user_id, batch_id, progress) VALUES ($1, $2, 45), ($1, $3, 20)
             ON CONFLICT DO NOTHING`, [studentId, batchId1, batchId2]
        );
        console.log('✅ Enrollments created');

        // 5. Lectures
        await client.query(
            `INSERT INTO lectures (batch_id, title, description, video_url, is_live, scheduled_time, duration_minutes) VALUES
             ($1, 'Newton''s Laws of Motion', 'Complete chapter on Newton''s three laws', 'https://youtube.com/watch?v=demo1', false, NOW() - INTERVAL '2 days', 90),
             ($1, 'Thermodynamics - Part 1', 'Introduction to thermodynamics concepts', 'https://youtube.com/watch?v=demo2', false, NOW() - INTERVAL '1 day', 75),
             ($1, 'Live: Organic Chemistry', 'Live session on organic chemistry basics', NULL, true, NOW() + INTERVAL '2 hours', 60)`, [batchId1]
        );
        console.log('✅ Lectures created');

        // 6. Banners
        await client.query(
            `INSERT INTO banners (title, description, image_url, redirect_type, is_active) VALUES
             ('🚀 New JEE Batch Starting!', 'Enroll now for JEE Advanced 2026 batch with top faculty', 'https://images.unsplash.com/photo-1523050854058-8df90110c476?w=800', 'batch', true),
             ('📝 Free Mock Test Series', 'Attempt free mock tests and evaluate your preparation', 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800', 'test', true),
             ('🎓 Scholarship Test - 50% Off!', 'Take the scholarship test and get up to 50% fee waiver', 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800', 'scholarship', true)`
        );
        console.log('✅ Banners created');

        // 7. Assignments
        const assign1 = await client.query(
            `INSERT INTO assignments (batch_id, title, description, due_date, total_marks) VALUES
             ($1, 'Physics - Kinematics Problems', 'Solve all 20 problem sets from Chapter 3', NOW() + INTERVAL '3 days', 50)
             RETURNING id`, [batchId1]
        );
        const assign2 = await client.query(
            `INSERT INTO assignments (batch_id, title, description, due_date, total_marks) VALUES
             ($1, 'Chemistry - Periodic Table Worksheet', 'Fill in the periodic table worksheet and submit', NOW() + INTERVAL '5 days', 30)
             RETURNING id`, [batchId1]
        );
        const assign3 = await client.query(
            `INSERT INTO assignments (batch_id, title, description, due_date, total_marks) VALUES
             ($1, 'Maths - Integration Practice', 'Complete the integration worksheet from the textbook', NOW() - INTERVAL '1 day', 40)
             RETURNING id`, [batchId1]
        );
        // One submitted assignment
        await client.query(
            `INSERT INTO submissions (assignment_id, user_id, status, marks) VALUES ($1, $2, 'graded', 35)
             ON CONFLICT DO NOTHING`, [assign3.rows[0].id, studentId]
        );
        console.log('✅ Assignments + submission created');

        // 8. Tests + Results
        const test1 = await client.query(
            `INSERT INTO tests (course_id, title, duration_minutes, scheduled_date, total_marks) VALUES
             ($1, 'Physics Unit Test 1', 60, NOW() + INTERVAL '5 days', 100) RETURNING id`, [courseId1]
        );
        const test2 = await client.query(
            `INSERT INTO tests (course_id, title, duration_minutes, scheduled_date, total_marks) VALUES
             ($1, 'Chemistry Mock Test', 90, NOW() - INTERVAL '7 days', 100) RETURNING id`, [courseId1]
        );
        await client.query(
            `INSERT INTO test_results (user_id, test_id, score, total_marks, rank) VALUES
             ($1, $2, 72, 100, 5)
             ON CONFLICT DO NOTHING`, [studentId, test2.rows[0].id]
        );
        console.log('✅ Tests + results created');

        // 9. Payments
        await client.query(
            `INSERT INTO payments (user_id, amount, description, status, due_date, paid_date, transaction_id) VALUES
             ($1, 12500, 'JEE Advanced - Installment 1', 'paid', '2026-01-15', '2026-01-14', 'TXN_' || substr(md5(random()::text), 0, 13)),
             ($1, 12500, 'JEE Advanced - Installment 2', 'pending', '2026-04-15', NULL, NULL)`, [studentId]
        );
        console.log('✅ Payments created');

        // 10. Events
        await client.query(
            `INSERT INTO events (title, description, event_date, location, banner_image) VALUES
             ('Annual Science Exhibition', 'Showcase your science projects and win exciting prizes!', NOW() + INTERVAL '15 days', 'Main Auditorium', 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800'),
             ('Parent-Teacher Meeting', 'Discuss student progress and academic performance with faculty.', NOW() + INTERVAL '7 days', 'Conference Hall', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800')`
        );
        console.log('✅ Events created');

        // 11. Doubts
        await client.query(
            `INSERT INTO doubts (user_id, subject, message, reply, status) VALUES
             ($1, 'Physics', 'Can you explain the concept of gravitational potential energy with an example?', 'Gravitational PE = mgh, where m is mass, g is acceleration due to gravity, and h is height. For example, a 5kg book at 2m height has PE = 5 × 9.8 × 2 = 98 J.', 'answered'),
             ($1, 'Chemistry', 'What is the difference between ionic and covalent bonds?', NULL, 'pending')`, [studentId]
        );
        console.log('✅ Doubts created');

        // 12. Attendance (last 20 days)
        for (let i = 0; i < 20; i++) {
            const present = Math.random() > 0.2; // 80% attendance
            await client.query(
                `INSERT INTO attendance (user_id, batch_id, date, is_present) VALUES ($1, $2, CURRENT_DATE - INTERVAL '${i} days', $3)
                 ON CONFLICT DO NOTHING`, [studentId, batchId1, present]
            );
        }
        console.log('✅ Attendance created');

        await client.query('COMMIT');
        console.log('\n🎉 All demo data seeded successfully!');
        console.log('📧 Demo Student Login: prashant@student.com / student123');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Seed error:', err.message);
    } finally {
        client.release();
        await pool.end();
        process.exit();
    }
}

seed();
