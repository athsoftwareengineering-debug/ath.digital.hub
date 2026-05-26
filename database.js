const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(path.join(dataDir, 'orders.db'));

db.serialize(() => {
  db.run(`
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
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('lastOrderId', '0')`);
});

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function getNextOrderId() {
  const row = await getAsync("SELECT value FROM settings WHERE key = 'lastOrderId'");
  const nextId = (parseInt(row?.value) || 0) + 1;
  await runAsync("UPDATE settings SET value = ? WHERE key = 'lastOrderId'", [nextId.toString()]);
  return nextId;
}

async function getAllOrders() {
  return await allAsync("SELECT * FROM orders ORDER BY createdAt DESC");
}

async function getOrdersByPhone(phone) {
  return await allAsync("SELECT * FROM orders WHERE phone = ? ORDER BY createdAt DESC", [phone]);
}

async function getOrderById(id) {
  return await getAsync("SELECT * FROM orders WHERE id = ?", [id]);
}

async function createOrder(order) {
  return await runAsync(`
    INSERT INTO orders (id, packageName, phone, price, status, createdAt, createdAtMyanmar, updatedAt, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [order.id, order.packageName, order.phone, order.price, order.status, 
       order.createdAt, order.createdAtMyanmar, order.updatedAt, order.note]);
}

async function updateOrderStatus(id, status, startDate = null, endDate = null, daysRemaining = null) {
  let query = `UPDATE orders SET status = ?, updatedAt = ?`;
  const params = [status, new Date().toISOString()];
  if (startDate) {
    query += `, startDate = ?, endDate = ?, daysRemaining = ?`;
    params.push(startDate, endDate, daysRemaining);
  }
  query += ` WHERE id = ?`;
  params.push(id);
  return await runAsync(query, params);
}

async function updateOrderScreenshot(id, screenshotPath) {
  return await runAsync(`UPDATE orders SET screenshotPath = ? WHERE id = ?`, [screenshotPath, id]);
}

async function updateOrderAlertDay(id, alertDay) {
  return await runAsync(`UPDATE orders SET lastAlertDay = ? WHERE id = ?`, [alertDay, id]);
}

async function updateOrderNote(id, note) {
  return await runAsync(`UPDATE orders SET note = ?, updatedAt = ? WHERE id = ?`, [note, new Date().toISOString(), id]);
}

async function updateExpiredOrders() {
  const today = new Date().toISOString();
  return await runAsync(`
    UPDATE orders 
    SET status = 'expired', isExpired = 1 
    WHERE status = 'approved' AND endDate < ? AND isExpired = 0
  `, [today]);
}

async function searchOrders(keyword) {
  return await allAsync(`
    SELECT * FROM orders 
    WHERE phone LIKE ? OR packageName LIKE ? OR note LIKE ?
    ORDER BY createdAt DESC
  `, [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`]);
}

async function deleteOrder(id) {
  return await runAsync(`DELETE FROM orders WHERE id = ?`, [id]);
}

async function getStats() {
  const stats = await getAsync(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending_payment' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'payment_received' THEN 1 ELSE 0 END) as paid,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN status = 'approved' THEN price ELSE 0 END) as revenue
    FROM orders
  `);
  return {
    total: stats?.total || 0,
    pending: stats?.pending || 0,
    paid: stats?.paid || 0,
    approved: stats?.approved || 0,
    rejected: stats?.rejected || 0,
    expired: stats?.expired || 0,
    revenue: stats?.revenue || 0
  };
}

function startExpiryChecker(intervalMinutes = 60) {
  let isRunning = false;
  const check = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const result = await updateExpiredOrders();
      if (result.changes > 0) {
        console.log(`✅ [${new Date().toLocaleString()}] Expired ${result.changes} orders`);
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
  updateOrderNote,
  updateExpiredOrders,
  searchOrders,
  deleteOrder,
  getStats,
  startExpiryChecker
};
