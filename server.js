const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'orders.db');
const db = new sqlite3.Database(dbPath);

// Initialize tables
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
    validityDays INTEGER,
    userId TEXT,
    userEmail TEXT,
    userName TEXT
  )`);
});

function getAllOrders() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM orders ORDER BY id DESC", (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getOrderById(id) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM orders WHERE id = ?", [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getOrdersByPhone(phone) {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM orders WHERE phone = ? ORDER BY id DESC", [phone], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getOrdersByUserId(userId) {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM orders WHERE userId = ? ORDER BY id DESC", [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getNextOrderId() {
  return new Promise((resolve, reject) => {
    db.get("SELECT MAX(id) as maxId FROM orders", (err, row) => {
      if (err) reject(err);
      else resolve((row?.maxId || 0) + 1);
    });
  });
}

function createOrder(order) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO orders (id, packageName, phone, price, status, createdAt, createdAtMyanmar, updatedAt, note, userId, userEmail, userName)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order.id, order.packageName, order.phone, order.price, order.status, order.createdAt, order.createdAtMyanmar, order.updatedAt, order.note, order.userId, order.userEmail, order.userName],
      (err) => {
        if (err) reject(err);
        else resolve();
      });
  });
}

function updateOrderStatus(id, status, startDate = null, endDate = null, validityDays = null) {
  return new Promise((resolve, reject) => {
    const updates = { status, updatedAt: new Date().toISOString() };
    if (startDate) updates.startDate = startDate;
    if (endDate) updates.endDate = endDate;
    if (validityDays) updates.validityDays = validityDays;
    
    db.run(`UPDATE orders SET status = ?, updatedAt = ?, startDate = COALESCE(?, startDate), endDate = COALESCE(?, endDate), validityDays = COALESCE(?, validityDays)
            WHERE id = ?`,
      [status, updates.updatedAt, startDate, endDate, validityDays, id],
      (err) => {
        if (err) reject(err);
        else resolve();
      });
  });
}

function updateOrderScreenshot(id, screenshotPath) {
  return new Promise((resolve, reject) => {
    db.run("UPDATE orders SET screenshotPath = ?, updatedAt = ? WHERE id = ?", [screenshotPath, new Date().toISOString(), id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function updateOrderNote(id, note) {
  return new Promise((resolve, reject) => {
    db.run("UPDATE orders SET note = ?, updatedAt = ? WHERE id = ?", [note, new Date().toISOString(), id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function deleteOrder(id) {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM orders WHERE id = ?", [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getStats() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending_payment' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'payment_received' THEN 1 ELSE 0 END) as received,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM orders`, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function searchOrders(query) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM orders WHERE phone LIKE ? OR packageName LIKE ? OR id LIKE ? ORDER BY id DESC`, 
      [`%${query}%`, `%${query}%`, `%${query}%`], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function startExpiryChecker(intervalMinutes) {
  setInterval(async () => {
    const now = new Date().toISOString();
    db.run("UPDATE orders SET status = 'expired' WHERE status = 'approved' AND endDate < ?", [now], (err) => {
      if (!err) console.log('✅ Expiry checker ran');
    });
  }, intervalMinutes * 60 * 1000);
}

module.exports = {
  getAllOrders,
  getOrderById,
  getOrdersByPhone,
  getOrdersByUserId,
  getNextOrderId,
  createOrder,
  updateOrderStatus,
  updateOrderScreenshot,
  updateOrderNote,
  deleteOrder,
  getStats,
  searchOrders,
  startExpiryChecker
};
