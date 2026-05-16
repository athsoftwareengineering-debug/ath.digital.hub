import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)  # front-end ခေါ်နိုင်ရန်

# ========== TELEGRAM SETTINGS ==========
BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"      # <-- သင့် Bot Token ထည့်
CHAT_ID = "YOUR_CHAT_ID_HERE"          # <-- သင့် Chat ID ထည့်

# ========== FILE UPLOAD SETTINGS ==========
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# ========== TELEGRAM သို့ ပုံပို့သည့် Function ==========
def send_screenshot_to_telegram(order_id, phone, package_name, image_path, note=""):
    """ Screenshot ကို Telegram Bot မှတစ်ဆင့် ပို့ပေးမယ် """
    try:
        caption = f"🆕 <b>New Payment Screenshot</b>\n"
        caption += f"📦 Package: {package_name}\n"
        caption += f"📞 Phone: {phone}\n"
        caption += f"🆔 Order ID: {order_id}\n"
        if note:
            caption += f"📝 Note: {note}\n"
        caption += f"🕐 Time: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
        with open(image_path, "rb") as photo:
            files = {"photo": photo}
            data = {
                "chat_id": CHAT_ID,
                "caption": caption,
                "parse_mode": "HTML"
            }
            response = requests.post(url, data=data, files=files)
        
        if response.status_code == 200:
            return True, "Sent to Telegram"
        else:
            return False, f"Telegram error: {response.text}"
    except Exception as e:
        return False, str(e)

# ========== API: /order (Order ဖန်တီးရန်) ==========
@app.route("/order", methods=["POST"])
def create_order():
    data = request.get_json()
    package_name = data.get("packageName")
    phone = data.get("phone")
    
    if not package_name or not phone:
        return jsonify({"success": False, "message": "Missing packageName or phone"}), 400
    
    # Order ID ပြုလုပ်ခြင်း (သင်စိတ်ကြိုက်ပြောင်းနိုင်)
    import uuid
    order_id = f"MYTEL-{uuid.uuid4().hex[:8].upper()}"
    
    return jsonify({
        "success": True,
        "orderId": order_id,
        "message": "Order created successfully"
    })

# ========== API: /submit-payment (Screenshot လက်ခံပြီး Bot သို့ပို့) ==========
@app.route("/submit-payment", methods=["POST"])
def submit_payment():
    # form-data မှ အချက်အလက်များယူခြင်း
    order_id = request.form.get("orderId")
    package_name = request.form.get("packageName")
    phone = request.form.get("phone")
    note = request.form.get("note", "")
    
    if not order_id or not package_name or not phone:
        return jsonify({"success": False, "message": "Missing required fields"}), 400
    
    # screenshot ဖိုင်ယူခြင်း
    if "screenshot" not in request.files:
        return jsonify({"success": False, "message": "No screenshot file"}), 400
    
    file = request.files["screenshot"]
    if file.filename == "":
        return jsonify({"success": False, "message": "Empty filename"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"success": False, "message": "Invalid file type (only images)"}), 400
    
    # ဖိုင်သိမ်းဆည်းခြင်း
    filename = secure_filename(f"{order_id}_{file.filename}")
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)
    
    # 📤 Telegram Bot သို့ ပုံပို့မယ်
    success, msg = send_screenshot_to_telegram(order_id, phone, package_name, filepath, note)
    
    if success:
        # သိမ်းထားတဲ့ ဖိုင်ကို ဖျက်ချင်ရင် ဖွင့်ပါ (သို့မဟုတ် သိမ်းထားနိုင်)
        # os.remove(filepath)
        return jsonify({"success": True, "message": "Payment screenshot received and sent to admin bot"})
    else:
        return jsonify({"success": False, "message": f"Screenshot saved but bot error: {msg}"}), 500

# ========== START SERVER ==========
if __name__ == "__main__":
    print("=" * 50)
    print("🚀 Server is running on http://localhost:5000")
    print("📤 Screenshots will be sent to Telegram Bot")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=True)