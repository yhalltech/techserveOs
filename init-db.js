#!/usr/bin/env node

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const readline = require('readline');
require('dotenv').config();

// PostgreSQL connection
const pool = new Pool({
    user: process.env.DB_USER || 'your_username',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'techserve',
    password: process.env.DB_PASSWORD || 'your_password',
    port: process.env.DB_PORT || 5432,
});

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to get user input
const askQuestion = (question) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
};

// Function to get password input (hidden)
const askPassword = (question) => {
    return new Promise((resolve) => {
        process.stdout.write(question);
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        
        let password = '';
        process.stdin.on('data', function(char) {
            char = char + '';
            
            switch(char) {
                case '\n':
                case '\r':
                case '\u0004':
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    process.stdout.write('\n');
                    resolve(password);
                    break;
                case '\u0003':
                    process.exit();
                    break;
                default:
                    if (char.charCodeAt(0) === 8) {
                        password = password.slice(0, -1);
                        process.stdout.write('\b \b');
                    } else {
                        password += char;
                        process.stdout.write('*');
                    }
                    break;
            }
        });
    });
};

// Create all necessary tables
const createTables = async () => {
    console.log('🏗️  Creating database tables...');
    
    // Operating Systems table
    const osTable = `
        CREATE TABLE IF NOT EXISTS operating_systems (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            type VARCHAR(20) NOT NULL CHECK (type IN ('windows', 'linux')),
            logo_url TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    // OS Versions table
    const osVersionsTable = `
        CREATE TABLE IF NOT EXISTS os_versions (
            id SERIAL PRIMARY KEY,
            os_id INTEGER REFERENCES operating_systems(id),
            version VARCHAR(50) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    // Orders table
    const ordersTable = `
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            order_number VARCHAR(20) UNIQUE NOT NULL,
            installation_type VARCHAR(10) NOT NULL CHECK (installation_type IN ('full', 'dual')),
            customer_name VARCHAR(100) NOT NULL,
            customer_email VARCHAR(100) NOT NULL,
            customer_phone VARCHAR(20) NOT NULL,
            customer_address TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    // Order OS selections table
    const orderOsTable = `
        CREATE TABLE IF NOT EXISTS order_os_selections (
            id SERIAL PRIMARY KEY,
            order_id INTEGER REFERENCES orders(id),
            os_id INTEGER REFERENCES operating_systems(id),
            version_id INTEGER REFERENCES os_versions(id)
        )
    `;

    // Order addons table
    const orderAddonsTable = `
        CREATE TABLE IF NOT EXISTS order_addons (
            id SERIAL PRIMARY KEY,
            order_id INTEGER REFERENCES orders(id),
            addon_type VARCHAR(50) NOT NULL,
            price DECIMAL(10, 2) NOT NULL
        )
    `;

    // Pricing table
    const pricingTable = `
        CREATE TABLE IF NOT EXISTS pricing (
            id SERIAL PRIMARY KEY,
            service_type VARCHAR(50) UNIQUE NOT NULL,
            price DECIMAL(10, 2) NOT NULL
        )
    `;

    // Admin users table
    const adminUsersTable = `
        CREATE TABLE IF NOT EXISTS admin_users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    try {
        await pool.query(osTable);
        await pool.query(osVersionsTable);
        await pool.query(ordersTable);
        await pool.query(orderOsTable);
        await pool.query(orderAddonsTable);
        await pool.query(pricingTable);
        await pool.query(adminUsersTable);
        console.log('✅ Tables created successfully');
        return true;
    } catch (err) {
        console.error('❌ Error creating tables:', err);
        return false;
    }
};

// Insert default data
const insertDefaultData = async () => {
    console.log('📊 Inserting default data...');
    
    try {
        // Insert default pricing
        await pool.query(`
            INSERT INTO pricing (service_type, price) 
            VALUES 
                ('full_installation', 100.00),
                ('dual_boot_installation', 150.00),
                ('additional_drivers', 30.00),
                ('office_suite', 50.00)
            ON CONFLICT (service_type) DO UPDATE SET
                price = EXCLUDED.price
        `);
        console.log('✅ Default pricing inserted');

        // Insert sample operating systems
        const osResult = await pool.query(`
            INSERT INTO operating_systems (name, type, logo_url) 
            VALUES 
                ('Ubuntu', 'linux', '/images/ubuntu-logo.png'),
                ('Linux Mint', 'linux', '/images/mint-logo.png'),
                ('Windows 10', 'windows', '/images/windows-logo.png'),
                ('Windows 11', 'windows', '/images/windows-logo.png')
            ON CONFLICT DO NOTHING
            RETURNING id, name
        `);

        if (osResult.rows.length > 0) {
            console.log('✅ Sample operating systems inserted');
            
            // Insert versions for each OS
            for (const os of osResult.rows) {
                if (os.name === 'Ubuntu') {
                    await pool.query(`
                        INSERT INTO os_versions (os_id, version) 
                        VALUES 
                            ($1, '22.04 LTS'),
                            ($1, '24.04 LTS')
                        ON CONFLICT DO NOTHING
                    `, [os.id]);
                } else if (os.name === 'Linux Mint') {
                    await pool.query(`
                        INSERT INTO os_versions (os_id, version) 
                        VALUES 
                            ($1, '21.3'),
                            ($1, '22.0')
                        ON CONFLICT DO NOTHING
                    `, [os.id]);
                } else if (os.name.startsWith('Windows')) {
                    await pool.query(`
                        INSERT INTO os_versions (os_id, version) 
                        VALUES 
                            ($1, 'Home'),
                            ($1, 'Pro')
                        ON CONFLICT DO NOTHING
                    `, [os.id]);
                }
            }
            console.log('✅ OS versions inserted');
        }

        return true;
    } catch (err) {
        console.error('❌ Error inserting default data:', err);
        return false;
    }
};

// Create admin user
const createAdminUser = async () => {
    console.log('\n👤 Admin User Setup');
    console.log('===================');
    
    try {
        // Check if admin users already exist
        const existingAdmins = await pool.query('SELECT COUNT(*) FROM admin_users WHERE is_active = true');
        const adminCount = parseInt(existingAdmins.rows[0].count);
        
        if (adminCount > 0) {
            console.log(`ℹ️  ${adminCount} admin user(s) already exist in the database.`);
            const createAnother = await askQuestion('Do you want to create another admin user? (y/N): ');
            if (createAnother.toLowerCase() !== 'y' && createAnother.toLowerCase() !== 'yes') {
                return true;
            }
        }
        
        console.log('\nCreating new admin user...');
        
        let username;
        while (true) {
            username = await askQuestion('Enter admin username: ');
            if (!username.trim()) {
                console.log('❌ Username cannot be empty');
                continue;
            }
            
            // Check if username exists
            const existingUser = await pool.query('SELECT id FROM admin_users WHERE username = $1', [username.trim()]);
            if (existingUser.rows.length > 0) {
                console.log('❌ Username already exists. Please choose a different username.');
                continue;
            }
            
            break;
        }
        
        let password;
        while (true) {
            password = await askPassword('Enter admin password (minimum 8 characters): ');
            if (password.length < 8) {
                console.log('❌ Password must be at least 8 characters long');
                continue;
            }
            
            const confirmPassword = await askPassword('Confirm password: ');
            if (password !== confirmPassword) {
                console.log('❌ Passwords do not match');
                continue;
            }
            
            break;
        }
        
        // Create admin user
        const hashedPassword = await bcrypt.hash(password, 12);
        const result = await pool.query(
            'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username.trim(), hashedPassword]
        );
        
        console.log(`✅ Admin user created successfully: ${result.rows[0].username}`);
        return true;
        
    } catch (err) {
        console.error('❌ Error creating admin user:', err);
        return false;
    }
};

// Main initialization function
const initializeDatabase = async () => {
    console.log('🚀 TechServe Database Initialization');
    console.log('===================================\n');
    
    try {
        // Test database connection
        console.log('🔌 Testing database connection...');
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful\n');
        
        // Create tables
        const tablesCreated = await createTables();
        if (!tablesCreated) {
            process.exit(1);
        }
        
        // Insert default data
        const dataInserted = await insertDefaultData();
        if (!dataInserted) {
            process.exit(1);
        }
        
        // Create admin user
        const adminCreated = await createAdminUser();
        if (!adminCreated) {
            process.exit(1);
        }
        
        console.log('\n🎉 Database initialization completed successfully!');
        console.log('\nYou can now start the server with: npm start');
        console.log('Access the admin panel at: http://localhost:3000/admin-login.html');
        
    } catch (err) {
        console.error('❌ Database initialization failed:', err);
        process.exit(1);
    } finally {
        rl.close();
        await pool.end();
    }
};

// Run initialization
if (require.main === module) {
    initializeDatabase();
}

module.exports = { initializeDatabase };
