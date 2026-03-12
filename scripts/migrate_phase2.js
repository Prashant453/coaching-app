const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('Running Phase 2 Migrations...');
        await client.query('BEGIN');

        // 1. Users table changes
        console.log('Adding fcm_token to users...');
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;`);

        // 2. Courses table changes
        console.log('Adding offer columns to courses...');
        await client.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS offer_price DECIMAL(10, 2);`);
        await client.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS offer_start_time TIMESTAMP WITH TIME ZONE;`);
        await client.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS offer_end_time TIMESTAMP WITH TIME ZONE;`);

        // 3. Coupons table creation
        console.log('Creating coupons table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS coupons (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                code VARCHAR(50) UNIQUE NOT NULL,
                discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
                discount_value DECIMAL(10, 2) NOT NULL,
                max_usage INTEGER DEFAULT 100,
                current_usage INTEGER DEFAULT 0,
                course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
                expiry_date TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
        `);

        // 4. Purchases table changes
        console.log('Altering purchases table...');
        // Make razorpay_order_id nullable
        await client.query(`ALTER TABLE purchases ALTER COLUMN razorpay_order_id DROP NOT NULL;`);

        // Add new columns
        await client.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL;`);

        // Handle ENUM/CHECK constraints for access_type. Safest way is to just add it as VARCHAR without complex constraint handling if it exists, or adding it carefully.
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='access_type') THEN
                    ALTER TABLE purchases ADD COLUMN access_type VARCHAR(50) DEFAULT 'paid' CHECK (access_type IN ('paid', 'admin_granted'));
                END IF;
            END $$;
        `);

        await client.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS granted_by_admin UUID REFERENCES users(id) ON DELETE SET NULL;`);

        await client.query('COMMIT');
        console.log('✅ Phase 2 Migrations completed successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
