require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const bcrypt = require("bcrypt");
const { pool } = require("./config/db");

// Route imports
const authRoutes = require("./routes/auth.routes");
const courseRoutes = require("./routes/course.routes");
const paymentRoutes = require("./routes/payment.routes");
const testRoutes = require("./routes/test.routes");
const studentRoutes = require("./routes/student.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// Auto-seed Admin User
const seedAdmin = async () => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.log("Admin credentials not fully provided in .env. Skipping auto-seed.");
            return;
        }

        const checkAdmin = await pool.query("SELECT * FROM users WHERE email = $1", [adminEmail]);
        if (checkAdmin.rows.length === 0) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(adminPassword, salt);

            await pool.query(
                "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)",
                ["Super Admin", adminEmail, hashedPassword, "admin"]
            );
            console.log("✅ Super Admin user seeded successfully.");
        } else {
            // Already exists
            // console.log("Admin user already logical exists. Continuing.");
        }
    } catch (err) {
        console.error("Error seeding admin user:", err.message);
    }
};

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/admin", adminRoutes);

// Root Endpoint
app.get("/", (req, res) => {
    res.send("Coaching API Running");
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await seedAdmin();
});