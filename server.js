const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Enhanced CORS configuration
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security middleware
app.use((req, res, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
    next();
});

// Rate limiting for login attempts
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

const rateLimitLogin = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (loginAttempts.has(ip)) {
        const attempts = loginAttempts.get(ip);
        
        // Clean up old attempts
        const recentAttempts = attempts.filter(time => now - time < LOCKOUT_TIME);
        
        if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
            return res.status(429).json({ 
                error: 'Too many login attempts. Please try again in 15 minutes.' 
            });
        }
        
        loginAttempts.set(ip, recentAttempts);
    }
    
    next();
};

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'techserve-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// PostgreSQL connection
const pool = new Pool({
    user: process.env.DB_USER || 'your_username',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'techserve',
    password: process.env.DB_PASSWORD || 'your_password',
    port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Database connection error:', err);
});

// Authentication middleware
const requireAuth = (req, res, next) => {
    console.log('Auth middleware - Session exists:', !!req.session);
    console.log('Auth middleware - Admin in session:', !!req.session?.admin);
    
    if (req.session && req.session.admin) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
};

// Input validation middleware for phone numbers
const validatePhone = (req, res, next) => {
    if (req.body.customerPhone) {
        const phoneRegex = /^07\d{8}$/; // Starts with 07 and has 10 digits total
        if (!phoneRegex.test(req.body.customerPhone)) {
            return res.status(400).json({ error: 'Phone number must start with 07 and have 10 digits' });
        }
    }
    next();
};

// Create tables if they don't exist
const createTables = async () => {
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

    // Pricing table with unique constraint
    const pricingTable = `
        CREATE TABLE IF NOT EXISTS pricing (
            id SERIAL PRIMARY KEY,
            service_type VARCHAR(50) UNIQUE NOT NULL,
            price DECIMAL(10, 2) NOT NULL
        )
    `;

    // Admin users table
    const adminUsersTable= `
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
        console.log('Tables created successfully');
        
        // Insert default pricing if not exists
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
        
        console.log('Default pricing inserted');
        
        // Check if any admin users exist, if not, provide instructions
        const existingAdmins = await pool.query('SELECT COUNT(*) FROM admin_users WHERE is_active = true');
        const adminCount = parseInt(existingAdmins.rows[0].count);
        
        if (adminCount === 0) {
            console.log('\n⚠️  WARNING: No admin users found!');
            console.log('Please create an admin user using one of these methods:');
            console.log('1. Use the /api/admin/create-first-admin endpoint (one-time only)');
            console.log('2. Use the admin creation script');
            console.log('3. Create manually via database\n');
        } else {
            console.log(`✓ ${adminCount} admin user(s) found in database`);
        }
        
    } catch (err) {
        console.error('Error creating tables:', err);
    }
};

// Initialize database
createTables();

// Routes

// One-time first admin creation (only works when no admins exist)
app.post('/api/admin/create-first-admin', async (req, res) => {
    const { username, password, secret_key } = req.body;
    
    // Security: require a secret key from environment
    if (!secret_key || secret_key !== process.env.ADMIN_SETUP_KEY) {
        return res.status(403).json({ error: 'Invalid setup key' });
    }
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    try {
        // Check if any admin users already exist
        const existingAdmins = await pool.query('SELECT COUNT(*) FROM admin_users WHERE is_active = true');
        const adminCount = parseInt(existingAdmins.rows[0].count);
        
        if (adminCount > 0) {
            return res.status(403).json({ error: 'Admin users already exist. Use regular admin creation instead.' });
        }
        
        // Create the first admin
        const hashedPassword = await bcrypt.hash(password, 12);
        const result = await pool.query(
            'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username.trim(), hashedPassword]
        );
        
        console.log('First admin user created successfully:', result.rows[0].username);
        
        res.status(201).json({ 
            message: 'First admin user created successfully',
            admin: { id: result.rows[0].id, username: result.rows[0].username }
        });
        
    } catch (err) {
        console.error('Error creating first admin:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Enhanced admin login with detailed logging and rate limiting
app.post('/api/admin/login', rateLimitLogin, async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    const { username, password } = req.body;
    
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Username:', username);
    console.log('Password length:', password ? password.length : 0);
    console.log('Request headers:', req.headers);
    
    if (!username || !password) {
        console.log('Missing credentials');
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    try {
        // Check if user exists
        const result = await pool.query(
            'SELECT * FROM admin_users WHERE username = $1 AND is_active = true',
            [username.trim()]
        );
        
        console.log('Database query executed');
        console.log('Users found:', result.rows.length);
        
        if (result.rows.length === 0) {
            console.log('No user found with username:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const admin = result.rows[0];
        console.log('User found:', admin.username);
        console.log('Password hash from DB:', admin.password_hash.substring(0, 20) + '...');
        
        // Compare passwords
        console.log('Comparing password...');
        const validPassword = await bcrypt.compare(password, admin.password_hash);
        console.log('Password comparison result:', validPassword);
        
        if (!validPassword) {
            console.log('Password comparison failed');
            
            // Track failed login attempt
            const now = Date.now();
            if (!loginAttempts.has(ip)) {
                loginAttempts.set(ip, []);
            }
            loginAttempts.get(ip).push(now);
            
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Set session
        req.session.admin = {
            id: admin.id,
            username: admin.username
        };
        
        console.log('Session data set:', req.session.admin);
        
        // Save session explicitly and send response
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Session error' });
            }
            
            console.log('Session saved successfully');
            console.log('=== LOGIN SUCCESSFUL ===');
            
            res.json({ 
                message: 'Login successful', 
                authenticated: true,
                user: {
                    id: admin.id,
                    username: admin.username
                }
            });
        });
        
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    console.log('Logout request received');
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        console.log('Session destroyed successfully');
        res.json({ message: 'Logout successful' });
    });
});

// Check admin authentication with detailed logging
app.get('/api/admin/check-auth', (req, res) => {
    console.log('=== AUTH CHECK ===');
    console.log('Session exists:', !!req.session);
    console.log('Session ID:', req.session?.id);
    console.log('Admin in session:', !!req.session?.admin);
    console.log('Admin data:', req.session?.admin);
    
    if (req.session && req.session.admin) {
        console.log('Authentication successful');
        res.json({ authenticated: true, admin: req.session.admin });
    } else {
        console.log('Authentication failed');
        res.json({ authenticated: false });
    }
});

// Get all operating systems with their versions
app.get('/api/operating-systems', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                os.id as os_id, 
                os.name as os_name, 
                os.type as os_type, 
                os.logo_url as os_logo,
                os.is_active as os_active,
                v.id as version_id,
                v.version as version_name,
                v.is_active as version_active
            FROM operating_systems os
            LEFT JOIN os_versions v ON os.id = v.os_id
            WHERE os.is_active = true AND (v.is_active = true OR v.is_active IS NULL)
            ORDER BY os.name, v.version
        `);
        
        // Group by OS
        const osMap = {};
        result.rows.forEach(row => {
            if (!osMap[row.os_id]) {
                osMap[row.os_id] = {
                    id: row.os_id,
                    name: row.os_name,
                    type: row.os_type,
                    logo_url: row.os_logo,
                    is_active: row.os_active,
                    versions: []
                };
            }
            if (row.version_id) {
                osMap[row.os_id].versions.push({
                    id: row.version_id,
                    name: row.version_name,
                    is_active: row.version_active
                });
            }
        });

        const osList = Object.values(osMap);
        res.json(osList);
    } catch (err) {
        console.error('Error fetching operating systems:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all orders
app.get('/api/orders', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                o.*,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'os_id', os.id,
                            'os_name', os.name,
                            'version_id', v.id,
                            'version_name', v.version
                        )
                    ) FILTER (WHERE os.id IS NOT NULL),
                    '[]'
                ) as os_selections,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'addon_type', oa.addon_type,
                            'price', oa.price
                        )
                    ) FILTER (WHERE oa.addon_type IS NOT NULL),
                    '[]'
                ) as addons
            FROM orders o
            LEFT JOIN order_os_selections oos ON o.id = oos.order_id
            LEFT JOIN operating_systems os ON oos.os_id = os.id
            LEFT JOIN os_versions v ON oos.version_id = v.id
            LEFT JOIN order_addons oa ON o.id = oa.order_id
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get order by order number
app.get('/api/orders/:orderNumber', async (req, res) => {
    const { orderNumber } = req.params;
    
    try {
        const result = await pool.query(`
            SELECT 
                o.*,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'os_id', os.id,
                            'os_name', os.name,
                            'version_id', v.id,
                            'version_name', v.version
                        )
                    ) FILTER (WHERE os.id IS NOT NULL),
                    '[]'
                ) as os_selections,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'addon_type', oa.addon_type,
                            'price', oa.price
                        )
                    ) FILTER (WHERE oa.addon_type IS NOT NULL),
                    '[]'
                ) as addons
            FROM orders o
            LEFT JOIN order_os_selections oos ON o.id = oos.order_id
            LEFT JOIN operating_systems os ON oos.os_id = os.id
            LEFT JOIN os_versions v ON oos.version_id = v.id
            LEFT JOIN order_addons oa ON o.id = oa.order_id
            WHERE o.order_number = $1
            GROUP BY o.id
        `, [orderNumber]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching order:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Find order by email and phone
app.post('/api/orders/find', async (req, res) => {
    const { email, phone } = req.body;
    
    if (!email || !phone) {
        return res.status(400).json({ error: 'Email and phone are required' });
    }
    
    try {
        const result = await pool.query(`
            SELECT 
                o.*,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'os_id', os.id,
                            'os_name', os.name,
                            'version_id', v.id,
                            'version_name', v.version
                        )
                    ) FILTER (WHERE os.id IS NOT NULL),
                    '[]'
                ) as os_selections,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'addon_type', oa.addon_type,
                            'price', oa.price
                        )
                    ) FILTER (WHERE oa.addon_type IS NOT NULL),
                    '[]'
                ) as addons
            FROM orders o
            LEFT JOIN order_os_selections oos ON o.id = oos.order_id
            LEFT JOIN operating_systems os ON oos.os_id = os.id
            LEFT JOIN os_versions v ON oos.version_id = v.id
            LEFT JOIN order_addons oa ON o.id = oa.order_id
            WHERE o.customer_email = $1 AND o.customer_phone = $2
            GROUP BY o.id
            ORDER by o.created_at DESC
        `, [email, phone]);
        
        res.json(result.rows);
    } catch (err) {
        console.error('Error finding orders:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new order with phone validation
app.post('/api/orders', validatePhone, async (req, res) => {
    const {
        orderNumber,
        installationType,
        osSelections, // Array of {osId, versionId}
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        addons // Array of {type, price}
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Insert order
        const orderResult = await client.query(
            `INSERT INTO orders 
             (order_number, installation_type, customer_name, customer_email, customer_phone, customer_address) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id`,
            [orderNumber, installationType, customerName, customerEmail, customerPhone, customerAddress]
        );

        const orderId = orderResult.rows[0].id;

        // Insert OS selections
        for (const selection of osSelections) {
            await client.query(
                `INSERT INTO order_os_selections (order_id, os_id, version_id) 
                 VALUES ($1, $2, $3)`,
                [orderId, selection.osId, selection.versionId]
            );
        }

        // Insert addons
        for (const addon of addons) {
            await client.query(
                `INSERT INTO order_addons (order_id, addon_type, price) 
                 VALUES ($1, $2, $3)`,
                [orderId, addon.type, addon.price]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({ 
            message: 'Order created successfully',
            orderId,
            orderNumber 
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating order:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Update order status
app.put('/api/orders/:orderNumber/status', async (req, res) => {
    const { orderNumber } = req.params;
    const { status } = req.body;

    try {
        const result = await pool.query(
            'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_number = $2 RETURNING *',
            [status, orderNumber]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ 
            message: 'Order status updated successfully',
            order: result.rows[0] 
        });
    } catch (err) {
        console.error('Error updating order status:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin routes - require authentication
// Get all operating systems (admin view)
app.get('/api/admin/operating-systems', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                os.id as os_id, 
                os.name as os_name, 
                os.type as os_type, 
                os.logo_url as os_logo,
                os.is_active as os_active,
                v.id as version_id,
                v.version as version_name,
                v.is_active as version_active
            FROM operating_systems os
            LEFT JOIN os_versions v ON os.id = v.os_id
            ORDER BY os.name, v.version
        `);
        
        // Group by OS
        const osMap = {};
        result.rows.forEach(row => {
            if (!osMap[row.os_id]) {
                osMap[row.os_id] = {
                    id: row.os_id,
                    name: row.os_name,
                    type: row.os_type,
                    logo_url: row.os_logo,
                    is_active: row.os_active,
                    versions: []
                };
            }
            if (row.version_id) {
                osMap[row.os_id].versions.push({
                    id: row.version_id,
                    name: row.version_name,
                    is_active: row.version_active
                });
            }
        });

        const osList = Object.values(osMap);
        res.json(osList);
    } catch (err) {
        console.error('Error fetching operating systems:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin - Add new OS
app.post('/api/admin/operating-systems', requireAuth, async (req, res) => {
    const { name, type, logo_url } = req.body;
    
    if (!name || !type) {
        return res.status(400).json({ error: 'Name and type are required' });
    }
    
    try {
        const result = await pool.query(
            'INSERT INTO operating_systems (name, type, logo_url) VALUES ($1, $2, $3) RETURNING *',
            [name, type, logo_url]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding OS:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin - Update OS
app.put('/api/admin/operating-systems/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { name, type, logo_url, is_active } = req.body;
    
    try {
        const result = await pool.query(
            'UPDATE operating_systems SET name = $1, type = $2, logo_url = $3, is_active = $4 WHERE id = $5 RETURNING *',
            [name, type, logo_url, is_active, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'OS not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating OS:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin - Add OS version
app.post('/api/admin/os-versions', requireAuth, async (req, res) => {
    const { os_id, version } = req.body;
    
    if (!os_id || !version) {
        return res.status(400).json({ error: 'OS ID and version are required' });
    }
    
    try {
        const result = await pool.query(
            'INSERT INTO os_versions (os_id, version) VALUES ($1, $2) RETURNING *',
            [os_id, version]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding OS version:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin - Update OS version
app.put('/api/admin/os-versions/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { version, is_active } = req.body;
    
    try {
        const result = await pool.query(
            'UPDATE os_versions SET version = $1, is_active = $2 WHERE id = $3 RETURNING *',
            [version, is_active, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Version not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating OS version:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin - Get pricing
app.get('/api/admin/pricing', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pricing ORDER BY service_type');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching pricing:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin - Update pricing
app.put('/api/admin/pricing', requireAuth, async (req, res) => {
    const { service_type, price } = req.body;
    
    if (!service_type || price === undefined) {
        return res.status(400).json({ error: 'Service type and price are required' });
    }
    
    try {
        const result = await pool.query(
            'UPDATE pricing SET price = $1 WHERE service_type = $2 RETURNING *',
            [price, service_type]
        );
        
        if (result.rows.length === 0) {
            // Insert if not exists
            const insertResult = await pool.query(
                'INSERT INTO pricing (service_type, price) VALUES ($1, $2) RETURNING *',
                [service_type, price]
            );
            return res.json(insertResult.rows[0]);
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating pricing:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Debug endpoint to test database connection
app.get('/api/debug/db-test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as current_time');
        res.json({ 
            message: 'Database connection successful', 
            time: result.rows[0].current_time 
        });
    } catch (err) {
        console.error('Database test failed:', err);
        res.status(500).json({ error: 'Database connection failed', details: err.message });
    }
});

// Admin Management Endpoints (require authentication)

// Get all admin users (admin only)
app.get('/api/admin/users', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, is_active, created_at FROM admin_users ORDER BY created_at ASC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching admin users:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new admin user (admin only)
app.post('/api/admin/users', requireAuth, async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    // Check if username already exists
    try {
        const existingUser = await pool.query(
            'SELECT id FROM admin_users WHERE username = $1',
            [username.trim()]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Username already exists' });
        }
        
        // Create new admin user
        const hashedPassword = await bcrypt.hash(password, 12);
        const result = await pool.query(
            'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) RETURNING id, username, is_active, created_at',
            [username.trim(), hashedPassword]
        );
        
        console.log(`New admin user created: ${result.rows[0].username} by ${req.session.admin.username}`);
        
        res.status(201).json({ 
            message: 'Admin user created successfully',
            admin: result.rows[0]
        });
        
    } catch (err) {
        console.error('Error creating admin user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update admin user status (admin only)
app.put('/api/admin/users/:id/status', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    
    if (typeof is_active !== 'boolean') {
        return res.status(400).json({ error: 'is_active must be a boolean value' });
    }
    
    // Prevent deactivating yourself
    if (parseInt(id) === req.session.admin.id && !is_active) {
        return res.status(403).json({ error: 'Cannot deactivate your own account' });
    }
    
    try {
        const result = await pool.query(
            'UPDATE admin_users SET is_active = $1 WHERE id = $2 RETURNING id, username, is_active',
            [is_active, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Admin user not found' });
        }
        
        const action = is_active ? 'activated' : 'deactivated';
        console.log(`Admin user ${action}: ${result.rows[0].username} by ${req.session.admin.username}`);
        
        res.json({ 
            message: `Admin user ${action} successfully`,
            admin: result.rows[0]
        });
        
    } catch (err) {
        console.error('Error updating admin status:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Change admin password (admin only)
app.put('/api/admin/users/:id/password', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { current_password, new_password } = req.body;
    
    if (!new_password) {
        return res.status(400).json({ error: 'New password is required' });
    }
    
    if (new_password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    try {
        // If changing own password, verify current password
        if (parseInt(id) === req.session.admin.id) {
            if (!current_password) {
                return res.status(400).json({ error: 'Current password is required when changing your own password' });
            }
            
            const currentUser = await pool.query(
                'SELECT password_hash FROM admin_users WHERE id = $1',
                [id]
            );
            
            if (currentUser.rows.length === 0) {
                return res.status(404).json({ error: 'Admin user not found' });
            }
            
            const validPassword = await bcrypt.compare(current_password, currentUser.rows[0].password_hash);
            if (!validPassword) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
        }
        
        // Update password
        const hashedPassword = await bcrypt.hash(new_password, 12);
        const result = await pool.query(
            'UPDATE admin_users SET password_hash = $1 WHERE id = $2 RETURNING id, username',
            [hashedPassword, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Admin user not found' });
        }
        
        console.log(`Password changed for admin user: ${result.rows[0].username} by ${req.session.admin.username}`);
        
        res.json({ 
            message: 'Password changed successfully',
            admin: { id: result.rows[0].id, username: result.rows[0].username }
        });
        
    } catch (err) {
        console.error('Error changing password:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Debug endpoint to check admin users
app.get('/api/debug/admin-users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, is_active, created_at FROM admin_users');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching admin users:', err);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Admin login: http://localhost:${port}/admin-login.html`);
});
