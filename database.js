const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Database directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, 'ath_database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('📦 Connected to SQLite database at:', dbPath);
  }
});

// Initialize tables
db.serialize(() => {
  // Orders table
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE,
    packageName TEXT,
    phone TEXT,
    price INTEGER,
    status TEXT,
    createdAt TEXT,
    createdAtMyanmar TEXT,
    updatedAt TEXT,
    note TEXT,
    screenshotPath TEXT,
    startDate TEXT,
    endDate TEXT,
    daysRemaining INTEGER,
    userId TEXT,
    userEmail TEXT,
    userName TEXT
  )`);

  // Admins table (သီးသန့်)
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'admin',
    created_at TEXT,
    last_login TEXT,
    is_active INTEGER DEFAULT 1
  )`);

  // Admin settings table
  db.run(`CREATE TABLE IF NOT EXISTS admin_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
  )`);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username)`);

  // Insert default admin if not exists
  const defaultAdminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO admins (username, password_hash, email, full_name, role, created_at) 
    VALUES (?, ?, ?, ?, ?, ?)`, 
    ['admin', defaultAdminPassword, 'admin@athdigital.com', 'Super Admin', 'super_admin', new Date().toISOString()]);
});

// Promise wrappers
const run = (query, params = []) => new Promise((resolve, reject) => {
  db.run(query, params, function(err) {
    if (err) reject(err); else resolve(this);
  });
});

const get = (query, params = []) => new Promise((resolve, reject) => {
  db.get(query, params, (err, row) => {
    if (err) reject(err); else resolve(row);
  });
});

const all = (query, params = []) => new Promise((resolve, reject) => {
  db.all(query, params, (err, rows) => {
    if (err) reject(err); else resolve(rows);
  });
});

// ============= ORDER FUNCTIONS =============
const orderFunctions = {
  generateOrderNumber: () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ATH${year}${month}${day}${random}`;
  },

  createOrder: async (order) => {
    const orderNumber = orderFunctions.generateOrderNumber();
    return run(`INSERT INTO orders 
      (order_number, packageName, phone, price, status, createdAt, createdAtMyanmar, updatedAt, note, userId, userEmail, userName) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [orderNumber, order.packageName, order.phone, order.price, order.status, 
       order.createdAt, order.createdAtMyanmar, order.updatedAt, order.note || '',
       order.userId || '', order.userEmail || '', order.userName || '']
    );
  },

  getOrderById: (id) => {
    return get(`SELECT * FROM orders WHERE id = ?`, [id]);
  },

  getOrderByNumber: (orderNumber) => {
    return get(`SELECT * FROM orders WHERE order_number = ?`, [orderNumber]);
  },

  getAllOrders: () => {
    return all(`SELECT * FROM orders ORDER BY createdAt DESC`);
  },

  getOrdersByPhone: (phone) => {
    return all(`SELECT * FROM orders WHERE phone = ? ORDER BY createdAt DESC`, [phone]);
  },

  getOrdersByUserId: (userId) => {
    return all(`SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC`, [userId]);
  },

  getRecentOrders: (limit = 10) => {
    return all(`SELECT * FROM orders ORDER BY createdAt DESC LIMIT ?`, [limit]);
  },

  getOrdersByStatus: (status) => {
    return all(`SELECT * FROM orders WHERE status = ? ORDER BY createdAt DESC`, [status]);
  },

  updateOrderStatus: (id, status, startDate = null, endDate = null, daysRemaining = null) => {
    const now = new Date().toISOString();
    if (startDate && endDate) {
      return run(`UPDATE orders SET status = ?, startDate = ?, endDate = ?, daysRemaining = ?, updatedAt = ? WHERE id = ?`, 
        [status, startDate, endDate, daysRemaining, now, id]);
    } else {
      return run(`UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?`, 
        [status, now, id]);
    }
  },

  updateOrderScreenshot: (id, screenshotPath) => {
    return run(`UPDATE orders SET screenshotPath = ?, updatedAt = ? WHERE id = ?`, 
      [screenshotPath, new Date().toISOString(), id]);
  },

  updateOrderNote: (id, note) => {
    return run(`UPDATE orders SET note = ?, updatedAt = ? WHERE id = ?`, 
      [note, new Date().toISOString(), id]);
  },

  deleteOrder: (id) => {
    return run(`DELETE FROM orders WHERE id = ?`, [id]);
  },

  getStats: async () => {
    const total = await get(`SELECT COUNT(*) as c FROM orders`);
    const pending = await get(`SELECT COUNT(*) as c FROM orders WHERE status = 'pending_payment'`);
    const paid = await get(`SELECT COUNT(*) as c FROM orders WHERE status = 'payment_received'`);
    const approved = await get(`SELECT COUNT(*) as c FROM orders WHERE status = 'approved'`);
    const rejected = await get(`SELECT COUNT(*) as c FROM orders WHERE status = 'rejected'`);
    const revenue = await get(`SELECT SUM(price) as s FROM orders WHERE status = 'approved'`);
    
    return {
      total: total?.c || 0,
      pending: pending?.c || 0,
      paid: paid?.c || 0,
      approved: approved?.c || 0,
      rejected: rejected?.c || 0,
      revenue: revenue?.s || 0
    };
  },

  searchOrders: (query) => {
    return all(`SELECT * FROM orders WHERE phone LIKE ? OR order_number LIKE ? OR packageName LIKE ? ORDER BY createdAt DESC`, 
      [`%${query}%`, `%${query}%`, `%${query}%`]);
  }
};

// ============= ADMIN FUNCTIONS =============
const adminFunctions = {
  // Create new admin
  createAdmin: async (username, password, email, fullName, role = 'admin') => {
    const password_hash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();
    try {
      await run(`INSERT INTO admins (username, password_hash, email, full_name, role, created_at) 
        VALUES (?, ?, ?, ?, ?, ?)`, [username, password_hash, email, fullName, role, now]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Verify admin login
  verifyAdmin: async (username, password) => {
    const admin = await get(`SELECT * FROM admins WHERE username = ? AND is_active = 1`, [username]);
    if (!admin) return null;
    
    const isValid = bcrypt.compareSync(password, admin.password_hash);
    if (isValid) {
      // Update last login
      await run(`UPDATE admins SET last_login = ? WHERE id = ?`, [new Date().toISOString(), admin.id]);
      return admin;
    }
    return null;
  },

  // Get admin by ID
  getAdminById: (id) => {
    return get(`SELECT id, username, email, full_name, role, created_at, last_login, is_active FROM admins WHERE id = ?`, [id]);
  },

  // Get all admins
  getAllAdmins: () => {
    return all(`SELECT id, username, email, full_name, role, created_at, last_login, is_active FROM admins ORDER BY created_at DESC`);
  },

  // Update admin password
  updateAdminPassword: async (id, newPassword) => {
    const password_hash = bcrypt.hashSync(newPassword, 10);
    return run(`UPDATE admins SET password_hash = ? WHERE id = ?`, [password_hash, id]);
  },

  // Delete admin
  deleteAdmin: (id) => {
    return run(`DELETE FROM admins WHERE id = ?`, [id]);
  },

  // Update admin status
  updateAdminStatus: (id, isActive) => {
    return run(`UPDATE admins SET is_active = ? WHERE id = ?`, [isActive ? 1 : 0, id]);
  },

  // Get admin settings
  getSetting: async (key, defaultValue = null) => {
    const row = await get(`SELECT value FROM admin_settings WHERE key = ?`, [key]);
    return row ? row.value : defaultValue;
  },

  // Set admin setting
  setSetting: async (key, value) => {
    const now = new Date().toISOString();
    return run(`INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES (?, ?, ?)`, [key, value, now]);
  }
};

// ============= EXPORT ALL =============
module.exports = {
  ...orderFunctions,
  ...adminFunctions,
  // Utility functions
  updateExpiredOrders: async () => {
    const now = new Date().toISOString();
    const result = await run(`UPDATE orders SET status = 'expired', updatedAt = ? 
      WHERE status = 'approved' AND endDate < ? AND endDate IS NOT NULL`, [now, now]);
    return result.changes || 0;
  },

  startExpiryChecker: (intervalMinutes = 60) => {
    let isRunning = false;
    const check = async () => {
      if (isRunning) return;
      isRunning = true;
      try {
        const changed = await module.exports.updateExpiredOrders();
        if (changed > 0) {
          console.log(`✅ [${new Date().toLocaleString()}] Expired ${changed} orders`);
        }
      } catch (error) {
        console.error('❌ Expiry checker error:', error.message);
      } finally {
        isRunning = false;
      }
    };
    check();
    const interval = setInterval(check, intervalMinutes * 60 * 1000);
    return () => clearInterval(interval);
  }
};
