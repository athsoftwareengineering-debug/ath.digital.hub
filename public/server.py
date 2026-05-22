import os
import sqlite3
import uuid
import requests
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)

# ========== CONFIGURATION ==========
BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")
GROUP_CHAT_ID = os.getenv("GROUP_CHAT_ID")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "mytel2024")

# File upload settings
UPLOAD_FOLDER = "temp_uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}

# ========== DATABASE SETUP ==========
def get_db():
    """Get database connection"""
    db_path = os.path.join(os.path.dirname(__file__), 'data', 'orders.db')
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database tables"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Create orders table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT UNIQUE NOT NULL,
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
    ''')
    
    # Create settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    
    # Initialize counter
    cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('lastOrderId', '0')")
    
    conn.commit()
    conn.close()

init_db()

# ========== PACKAGES ==========
PACKAGES = {
    "VIP LEVEL - 1": {"price": 15000, "desc": "22GB / 8000 Mins / 5000 SMS"},
    "VIP LEVEL - 2": {"price": 20000, "desc": "40GB / 250 Mins / 25 Any Net"},
    "VIP LEVEL - 3": {"price": 25000, "desc": "40GB / 1400 Mins / 8000 SMS"},
    "VIP LEVEL - 4": {"price": 30000, "desc": "120GB High-Speed Data"}
}

# ========== HELPER FUNCTIONS ==========
def get_myanmar_time():
    """Get current time in Myanmar timezone"""
    now = datetime.now()
    return {
        "full": now.strftime("%Y-%m-%d %I:%M:%S %p"),
        "iso": now.isoformat(),
        "timestamp": int(now.timestamp())
    }

def get_next_order_id():
    """Get next auto-increment order ID"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'lastOrderId'")
    row = cursor.fetchone()
    next_id = (int(row['value']) if row else 0) + 1
    cursor.execute("UPDATE settings SET value = ? WHERE key = 'lastOrderId'", (str(next_id),))
    conn.commit()
    conn.close()
    return next_id

def allowed_file(filename):
    """Check if file extension is allowed"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# ========== TELEGRAM FUNCTIONS ==========
def send_telegram_message(chat_id, text):
    """Send text message to Telegram"""
    if not BOT_TOKEN or not chat_id:
        return False
    try:
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML"
        }
        response = requests.post(url, json=payload, timeout=10)
        return response.status_code == 200
    except Exception as e:
        print(f"Telegram error: {e}")
        return False

def send_telegram_photo(chat_id, image_path, caption, reply_markup=None):
    """Send photo to Telegram"""
    if not BOT_TOKEN or not chat_id:
        return False
    try:
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
        with open(image_path, "rb") as photo:
            files = {"photo": photo}
            data = {
                "chat_id": chat_id,
                "caption": caption,
                "parse_mode": "HTML"
            }
            if reply_markup:
                data["reply_markup"] = reply_markup
            response = requests.post(url, data=data, files=files, timeout=30)
        return response.status_code == 200
    except Exception as e:
        print(f"Telegram photo error: {e}")
        return False

# ========== API ENDPOINTS ==========

@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    """Admin login endpoint"""
    data = request.get_json()
    password = data.get("password")
    if password == ADMIN_PASSWORD:
        return jsonify({"success": True, "message": "Login successful"})
    return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route("/api/admin/orders", methods=["GET"])
def get_admin_orders():
    """Get all orders (admin only)"""
    auth_token = request.headers.get("x-admin-auth")
    if auth_token != ADMIN_PASSWORD:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders ORDER BY createdAt DESC")
    orders = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    # Calculate stats
    stats = {
        "total": len(orders),
        "pending": sum(1 for o in orders if o['status'] == 'pending_payment'),
        "paid": sum(1 for o in orders if o['status'] == 'payment_received'),
        "approved": sum(1 for o in orders if o['status'] == 'approved'),
        "rejected": sum(1 for o in orders if o['status'] == 'rejected'),
        "expired": sum(1 for o in orders if o['status'] == 'expired'),
        "revenue": sum(o['price'] for o in orders if o['status'] == 'approved')
    }
    
    return jsonify({"success": True, "orders": orders, "stats": stats})

@app.route("/api/admin/order-screenshot", methods=["GET"])
def get_order_screenshot():
    """Get screenshot URL for an order"""
    auth_token = request.headers.get("x-admin-auth")
    if auth_token != ADMIN_PASSWORD:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    order_id = request.args.get("orderId")
    if not order_id:
        return jsonify({"success": False, "message": "Order ID required"}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT screenshotPath FROM orders WHERE id = ?", (order_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row and row['screenshotPath']:
        return jsonify({"success": True, "screenshotUrl": row['screenshotPath']})
    return jsonify({"success": False, "message": "No screenshot"})

@app.route("/api/admin/update-order", methods=["POST"])
def update_order():
    """Update order status (admin only)"""
    auth_token = request.headers.get("x-admin-auth")
    if auth_token != ADMIN_PASSWORD:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    data = request.get_json()
    order_id = data.get("orderId")
    status = data.get("status")
    
    conn = get_db()
    cursor = conn.cursor()
    
    if status == "approved":
        start_date = datetime.now()
        end_date = start_date + timedelta(days=30)
        cursor.execute('''
            UPDATE orders 
            SET status = ?, updatedAt = ?, startDate = ?, endDate = ?, daysRemaining = ?
            WHERE id = ?
        ''', (status, datetime.now().isoformat(), start_date.isoformat(), 
              end_date.isoformat(), 30, order_id))
        
        # Get order details for notification
        cursor.execute("SELECT phone, packageName FROM orders WHERE id = ?", (order_id,))
        order = cursor.fetchone()
        if order:
            send_telegram_message(ADMIN_CHAT_ID, f"✅ Order #{order_id} approved! 30 days started.")
            if GROUP_CHAT_ID:
                send_telegram_message(GROUP_CHAT_ID, f"🚨 DATA ACTIVATED 🚨\n📞 {order['phone']}\n📦 {order['packageName']}\n⏳ 30 days valid")
    else:
        cursor.execute("UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?",
                      (status, datetime.now().isoformat(), order_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({"success": True})

@app.route("/order", methods=["POST"])
def create_order():
    """Create new order (customer)"""
    try:
        data = request.get_json()
        package_name = data.get("packageName")
        phone = data.get("phone")
        note = data.get("note", "")
        
        if not package_name or not phone:
            return jsonify({"success": False, "message": "Missing required fields"}), 400
        
        # Validate phone
        import re
        if not re.match(r"^(09|\+959)[0-9]{7,9}$", phone):
            return jsonify({"success": False, "message": "Invalid phone number"}), 400
        
        package = PACKAGES.get(package_name)
        if not package:
            return jsonify({"success": False, "message": "Invalid package"}), 400
        
        mt_time = get_myanmar_time()
        order_id = get_next_order_id()
        
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO orders (id, order_id, packageName, phone, price, status, createdAt, createdAtMyanmar, updatedAt, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (order_id, f"ORD-{order_id}", package_name, phone, package['price'], 
              "pending_payment", mt_time['iso'], mt_time['full'], mt_time['iso'], note))
        conn.commit()
        conn.close()
        
        # Notify admin
        send_telegram_message(ADMIN_CHAT_ID, 
            f"🆕 New Order #{order_id}\n📦 {package_name}\n📞 {phone}\n💰 {package['price']:,} KS\n✏️ Note: {note or 'None'}")
        
        return jsonify({"success": True, "orderId": order_id})
    except Exception as e:
        print(f"Create order error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/submit-payment", methods=["POST"])
def submit_payment():
    """Submit payment with screenshot"""
    try:
        order_id = request.form.get("orderId")
        note = request.form.get("note", "")
        
        if not order_id:
            return jsonify({"success": False, "message": "Order ID required"}), 400
        
        if "screenshot" not in request.files:
            return jsonify({"success": False, "message": "No screenshot file"}), 400
        
        file = request.files["screenshot"]
        if file.filename == "" or not allowed_file(file.filename):
            return jsonify({"success": False, "message": "Invalid file type"}), 400
        
        # Save file
        filename = secure_filename(f"{order_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg")
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(filepath)
        
        # Get order details
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT packageName, phone, price FROM orders WHERE id = ?", (order_id,))
        order = cursor.fetchone()
        
        if not order:
            conn.close()
            return jsonify({"success": False, "message": "Order not found"}), 404
        
        # Update order
        screenshot_path = f"/temp_uploads/{filename}"
        cursor.execute('''
            UPDATE orders 
            SET status = 'payment_received', screenshotPath = ?, updatedAt = ?, note = ?
            WHERE id = ?
        ''', (screenshot_path, datetime.now().isoformat(), note, order_id))
        conn.commit()
        conn.close()
        
        # Send to Telegram with inline keyboard
        caption = f"💰 Payment Received #{order_id}\n📦 {order['packageName']}\n📞 {order['phone']}\n💰 {order['price']:,} KS"
        reply_markup = {
            "inline_keyboard": [[
                {"text": "✅ Approve (30 Days)", "callback_data": f"approve_{order_id}"},
                {"text": "❌ Reject", "callback_data": f"reject_{order_id}"}
            ]]
        }
        
        send_telegram_photo(ADMIN_CHAT_ID, filepath, caption, reply_markup)
        
        # Optionally delete file after sending
        # os.remove(filepath)
        
        return jsonify({"success": True, "message": "Payment submitted!"})
    except Exception as e:
        print(f"Submit payment error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/track-by-phone", methods=["GET"])
def track_by_phone():
    """Track orders by phone number"""
    phone = request.args.get("phone")
    if not phone:
        return jsonify({"success": False, "message": "Phone required"}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE phone = ? ORDER BY createdAt DESC", (phone,))
    orders = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify({"success": True, "orders": orders, "count": len(orders)})

@app.route("/api/admin/search", methods=["GET"])
def search_orders():
    """Search orders (admin only)"""
    auth_token = request.headers.get("x-admin-auth")
    if auth_token != ADMIN_PASSWORD:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    keyword = request.args.get("q", "")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM orders 
        WHERE phone LIKE ? OR packageName LIKE ? OR note LIKE ? OR id LIKE ?
        ORDER BY createdAt DESC
    ''', (f'%{keyword}%', f'%{keyword}%', f'%{keyword}%', f'%{keyword}%'))
    orders = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify({"success": True, "orders": orders})

# ========== TELEGRAM WEBHOOK ==========
@app.route(f"/webhook/{BOT_TOKEN}", methods=["POST"])
def telegram_webhook():
    """Handle Telegram callback queries"""
    try:
        update = request.get_json()
        
        if update and "callback_query" in update:
            callback_data = update["callback_query"]["data"]
            message = update["callback_query"]["message"]
            chat_id = message["chat"]["id"]
            
            if callback_data.startswith("approve_"):
                order_id = callback_data.split("_")[1]
                
                conn = get_db()
                cursor = conn.cursor()
                cursor.execute("SELECT status, phone, packageName FROM orders WHERE id = ?", (order_id,))
                order = cursor.fetchone()
                
                if order and order['status'] == 'payment_received':
                    start_date = datetime.now()
                    end_date = start_date + timedelta(days=30)
                    cursor.execute('''
                        UPDATE orders 
                        SET status = 'approved', startDate = ?, endDate = ?, daysRemaining = 30, updatedAt = ?
                        WHERE id = ?
                    ''', (start_date.isoformat(), end_date.isoformat(), datetime.now().isoformat(), order_id))
                    conn.commit()
                    
                    send_telegram_message(chat_id, f"✅ Order #{order_id} approved! 30 days started.")
                    if GROUP_CHAT_ID:
                        send_telegram_message(GROUP_CHAT_ID, f"🚨 DATA ACTIVATED 🚨\n📞 {order['phone']}\n📦 {order['packageName']}\n⏳ 30 days valid")
                conn.close()
                
            elif callback_data.startswith("reject_"):
                order_id = callback_data.split("_")[1]
                conn = get_db()
                cursor = conn.cursor()
                cursor.execute("UPDATE orders SET status = 'rejected', updatedAt = ? WHERE id = ?",
                              (datetime.now().isoformat(), order_id))
                conn.commit()
                conn.close()
                send_telegram_message(chat_id, f"❌ Order #{order_id} rejected.")
            
            # Answer callback query
            requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/answerCallbackQuery",
                         json={"callback_query_id": update["callback_query"]["id"]})
        
        return jsonify({"status": "ok"})
    except Exception as e:
        print(f"Webhook error: {e}")
        return jsonify({"status": "ok"})

# ========== SERVE STATIC FILES ==========
@app.route('/')
def serve_index():
    return send_from_directory('public', 'index.html')

@app.route('/admin')
def serve_admin():
    return send_from_directory('public', 'admin.html')

@app.route('/temp_uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# ========== START SERVER ==========
if __name__ == "__main__":
    print("=" * 60)
    print("🚀 ATH DIGITAL HUB - Python Flask Server")
    print("=" * 60)
    print(f"📱 Customer: http://localhost:5000/")
    print(f"👑 Admin: http://localhost:5000/admin")
    print(f"🔑 Admin Password: {ADMIN_PASSWORD}")
    print(f"📨 BOT_TOKEN: {'✅' if BOT_TOKEN else '❌'}")
    print(f"👤 ADMIN_CHAT_ID: {'✅' if ADMIN_CHAT_ID else '❌'}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)
