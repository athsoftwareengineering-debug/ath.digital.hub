const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'orders.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    packageName TEXT NOT NULL,
    phone TEXT NOT NULL,
    price INTEGER NOT NULL,
    status TEXT DEFAULT 'pending_payment',
    createdAt TEXT NOT NULL,
    createdAtMyanmar TEXT,
    updatedAt TEXT,
    startDate TEXT,
    endDate TEXT,
    daysRemaining INTEGER,
    isExpired INTEGER DEFAULT 0,
    lastAlertDay INTEGER,
    screenshotPath TEXT,
    note TEXT
  );
  
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Initialize order counter
const initCounter = db.prepare(`
  INSERT OR IGNORE INTO settings (key, value) VALUES ('lastOrderId', '0')
`).run();

function getNextOrderId() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'lastOrderId'").get();
  const nextId = (parseInt(row?.value) || 0) + 1;
  db.prepare("UPDATE settings SET value = ? WHERE key = 'lastOrderId'").run(nextId.toString());
  return nextId;
}

function getAllOrders() {
  return db.prepare("SELECT * FROM orders ORDER BY createdAt DESC").all();
}

function getOrdersByPhone(phone) {
  return db.prepare("SELECT * FROM orders WHERE phone = ? ORDER BY createdAt DESC").all(phone);
}

function getOrderById(id) {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
}

function createOrder(order) {
  const stmt = db.prepare(`
    INSERT INTO orders (id, packageName, phone, price, status, createdAt, createdAtMyanmar, updatedAt, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(order.id, order.packageName, order.phone, order.price, 
                   order.status, order.createdAt, order.createdAtMyanmar, 
                   order.updatedAt, order.note);
}

function updateOrderStatus(id, status, startDate = null, endDate = null, daysRemaining = null) {
  let query = `UPDATE orders SET status = ?, updatedAt = ?`;
  const params = [status, new Date().toISOString()];
  
  if (startDate) {
    query += `, startDate = ?, endDate = ?, daysRemaining = ?`;
    params.push(startDate, endDate, daysRemaining);
  }
  
  query += ` WHERE id = ?`;
  params.push(id);
  
  return db.prepare(query).run(...params);
}

function updateOrderScreenshot(id, screenshotPath) {
  return db.prepare(`UPDATE orders SET screenshotPath = ? WHERE id = ?`).run(screenshotPath, id);
}

function updateOrderAlertDay(id, alertDay) {
  return db.prepare(`UPDATE orders SET lastAlertDay = ? WHERE id = ?`).run(alertDay, id);
}

function updateExpiredOrders() {
  const today = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE orders 
    SET status = 'expired', isExpired = 1 
    WHERE status = 'approved' AND endDate < ? AND isExpired = 0
  `);
  return stmt.run(today);
}

function getStats() {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending_payment' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'payment_received' THEN 1 ELSE 0 END) as paid,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN status = 'approved' THEN price ELSE 0 END) as revenue
    FROM orders
  `).get();
  
  return {
    total: stats.total || 0,
    pending: stats.pending || 0,
    paid: stats.paid || 0,
    approved: stats.approved || 0,
    rejected: stats.rejected || 0,
    expired: stats.expired || 0,
    revenue: stats.revenue || 0
  };
}

module.exports = {
  db,
  getNextOrderId,
  getAllOrders,
  getOrdersByPhone,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updateOrderScreenshot,
  updateOrderAlertDay,
  updateExpiredOrders,
  getStats
};
