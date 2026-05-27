const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Free Tier အတွက် - project folder အောက်မှာ data folder သုံးမယ်
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`📁 Created data directory: ${DATA_DIR}`);
}

const dbPath = path.join(DATA_DIR, 'orders.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('📦 Connected to SQLite database at:', dbPath);
  }
});

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
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
    isExpired INTEGER DEFAULT 0,
    userId TEXT,
    userEmail TEXT,
    userName TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('lastOrderId', '0')`);
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId)`);
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

module.exports = {
  getNextOrderId: async () => {
    const row = await get(`SELECT value FROM settings WHERE key = 'lastOrderId'`);
    const nextId = (parseInt(row?.value) || 0) + 1;
    await run(`UPDATE settings SET value = ? WHERE key = 'lastOrderId'`, [nextId.toString()]);
    return nextId;
  },

  createOrder: async (order) => {
    return run(`INSERT INTO orders 
      (id, packageName, phone, price, status, createdAt, createdAtMyanmar, updatedAt, note, userId, userEmail, userName) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [order.id, order.packageName, order.phone, order.price, order.status, 
       order.createdAt, order.createdAtMyanmar, order.updatedAt, order.note || '',
       order.userId || '', order.userEmail || '', order.userName || '']
    );
  },

  getOrderById: (id) => {
    return get(`SELECT * FROM orders WHERE id = ?`, [id]);
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

  searchOrders: (query) => {
    return all(`SELECT * FROM orders WHERE phone LIKE ? OR note LIKE ? OR packageName LIKE ? ORDER BY createdAt DESC`, 
      [`%${query}%`, `%${query}%`, `%${query}%`]);
  },

  updateOrderScreenshot: (id, screenshotPath) => {
    return run(`UPDATE orders SET screenshotPath = ?, updatedAt = ? WHERE id = ?`, 
      [screenshotPath, new Date().toISOString(), id]);
  },

  updateOrderNote: (id, note) => {
    return run(`UPDATE orders SET note = ?, updatedAt = ? WHERE id = ?`, 
      [note, new Date().toISOString(), id]);
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

  deleteOrder: (id) => {
    return run(`DELETE FROM orders WHERE id = ?`, [id]);
  },

  getStats: async () => {
    const total = await get(`SELECT COUNT(*) as c FROM orders`);
    const pending = await get(`SELECT COUNT(*) as c FROM orders WHERE status = 'pending_payment'`);
    const paid = await get(`SELECT COUNT(*) as c FROM orders WHERE status = 'payment_received'`);
    const approved = await get(`SELECT COUNT(*) as c FROM orders WHERE status = 'approved'`);
    const rejected = await get(`SELECT COUNT(*) as c FROM orders WHERE status = 'rejected'`);
    const expired = await get(`SELECT COUNT(*) as c FROM orders WHERE status = 'expired'`);
    const revenue = await get(`SELECT SUM(price) as s FROM orders WHERE status = 'approved'`);
    
    return {
      total: total?.c || 0,
      pending: pending?.c || 0,
      paid: paid?.c || 0,
      approved: approved?.c || 0,
      rejected: rejected?.c || 0,
      expired: expired?.c || 0,
      revenue: revenue?.s || 0
    };
  },

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
