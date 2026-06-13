<!DOCTYPE html>
<html lang="my">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>Admin Panel | ATH DIGITAL HUB</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { touch-action: pan-x pan-y; -webkit-text-size-adjust: 100%; }
        :root {
            --bg-deep: #0a0c15;
            --cyan: #00d4ff;
            --emerald: #10b981;
            --rose: #f43f5e;
            --amber: #f59e0b;
            --violet: #8b5cf6;
            --text-primary: #f1f5f9;
            --text-secondary: #94a3b8;
        }
        body {
            background: #0a0c15;
            color: var(--text-primary);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            min-height: 100vh;
            background-image: radial-gradient(ellipse at 20% 30%, rgba(139,92,246,0.15) 0%, transparent 60%),
                              radial-gradient(circle at 85% 70%, rgba(0,212,255,0.1) 0%, transparent 55%);
            padding: 12px;
            padding-bottom: 70px;
        }
        .container { max-width: 700px; margin: 0 auto; }
        .top-bar {
            backdrop-filter: blur(20px);
            background: rgba(10,12,21,0.7);
            border: 1px solid rgba(0,212,255,0.2);
            border-radius: 1.5rem;
            padding: 12px 16px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            position: relative;
            z-index: 200;
        }
        .top-bar-left { display: flex; align-items: center; gap: 12px; }
        .menu-btn {
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 1.3rem;
            cursor: pointer;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .menu-btn:hover { background: rgba(0,212,255,0.1); }
        .logo {
            font-size: 1.2rem;
            font-family: monospace;
            background: linear-gradient(135deg, #fff, var(--cyan));
            background-clip: text;
            -webkit-background-clip: text;
            color: transparent;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .top-bar-right { display: flex; align-items: center; gap: 8px; position: relative; }
        .top-icon-btn {
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 1.1rem;
            cursor: pointer;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            position: relative;
        }
        .top-icon-btn:hover { background: rgba(0,212,255,0.1); transform: rotate(15deg); }
        
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px; }
        .stat-card {
            background: linear-gradient(145deg, rgba(18,22,35,0.9), rgba(10,12,21,0.95));
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 1.2rem;
            padding: 12px;
            text-align: center;
        }
        .stat-number { font-size: 1.5rem; font-weight: 800; font-family: monospace; color: var(--cyan); }
        .stat-label { font-size: 0.6rem; color: var(--text-secondary); margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 4px; }
        .stat-number.profit { color: var(--emerald); }
        .stat-number.cost { color: var(--amber); }
        .bottom-nav {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(10,12,21,0.95);
            backdrop-filter: blur(20px);
            border-top: 1px solid rgba(0,212,255,0.1);
            display: flex;
            justify-content: space-around;
            padding: 8px 12px;
            padding-bottom: env(safe-area-inset-bottom, 12px);
            z-index: 100;
        }
        .nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 6px 12px;
            border-radius: 40px;
            font-size: 0.7rem;
            transition: all 0.2s;
        }
        .nav-item i { font-size: 1.3rem; }
        .nav-item.active { color: var(--cyan); background: rgba(0,212,255,0.1); }
        .nav-item:hover { background: rgba(0,212,255,0.05); }
        .drawer-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 200;
            visibility: hidden;
            opacity: 0;
            transition: all 0.3s;
        }
        .drawer-overlay.open { visibility: visible; opacity: 1; }
        .drawer {
            position: fixed;
            top: 0;
            left: -280px;
            width: 280px;
            height: 100%;
            background: linear-gradient(145deg, #0f111a, #0a0c15);
            border-right: 1px solid rgba(0,212,255,0.2);
            z-index: 201;
            transition: left 0.3s ease;
            padding: 20px;
            overflow-y: auto;
        }
        .drawer.open { left: 0; }
        .drawer-header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid rgba(0,212,255,0.1); margin-bottom: 20px; }
        .drawer-avatar {
            width: 70px;
            height: 70px;
            background: linear-gradient(135deg, var(--cyan), #0891b2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 12px;
            font-size: 1.8rem;
        }
        .drawer-title { font-weight: 700; font-size: 1rem; }
        .drawer-subtitle { font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px; }
        .drawer-stats {
            background: rgba(0,212,255,0.05);
            border-radius: 1rem;
            padding: 12px;
            margin-bottom: 20px;
            border: 1px solid rgba(0,212,255,0.1);
        }
        .drawer-stats-title { font-size: 0.7rem; color: var(--cyan); margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
        .drawer-stat-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .drawer-stat-item:last-child { border-bottom: none; }
        .drawer-stat-label { font-size: 0.7rem; color: var(--text-secondary); }
        .drawer-stat-value { font-size: 0.8rem; font-weight: 700; color: var(--cyan); }
        .drawer-menu { list-style: none; }
        .drawer-menu li { margin-bottom: 8px; }
        .drawer-menu a {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-radius: 1rem;
            color: var(--text-primary);
            text-decoration: none;
            transition: all 0.2s;
            cursor: pointer;
        }
        .drawer-menu a:hover { background: rgba(0,212,255,0.1); }
        .drawer-menu a i { width: 24px; color: var(--cyan); }
        .drawer-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 16px 0; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .search-bar {
            background: rgba(18,22,35,0.8);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(0,212,255,0.15);
            border-radius: 1rem;
            padding: 12px;
            margin-bottom: 16px;
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
        }
        .search-input {
            flex: 1;
            background: rgba(0,0,0,0.5);
            border: 1px solid #2d3a5e;
            border-radius: 40px;
            padding: 10px 16px;
            color: white;
            font-size: 0.8rem;
        }
        .search-input:focus { border-color: var(--cyan); outline: none; }
        .search-btn {
            background: rgba(0,212,255,0.15);
            border: 1px solid rgba(0,212,255,0.3);
            padding: 8px 20px;
            border-radius: 40px;
            font-size: 0.8rem;
            cursor: pointer;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .search-btn:hover { background: var(--cyan); color: #030712; }
        .clear-search { background: #334155; border: none; padding: 8px 16px; border-radius: 40px; font-size: 0.7rem; cursor: pointer; }
        .filter-bar {
            background: rgba(18,22,35,0.8);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(0,212,255,0.15);
            border-radius: 1rem;
            padding: 12px;
            margin-bottom: 16px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: space-between;
            align-items: center;
        }
        .filter-group { display: flex; flex-wrap: wrap; gap: 8px; flex: 1; }
        .filter-input {
            background: rgba(0,0,0,0.5);
            border: 1px solid #2d3a5e;
            border-radius: 40px;
            padding: 8px 12px;
            color: white;
            font-size: 0.7rem;
            flex: 1;
            min-width: 100px;
        }
        .filter-btn {
            background: rgba(0,212,255,0.15);
            border: 1px solid rgba(0,212,255,0.3);
            padding: 8px 16px;
            border-radius: 40px;
            font-size: 0.7rem;
            cursor: pointer;
            font-weight: 500;
        }
        .filter-btn:hover { background: var(--cyan); color: #030712; }
        .orders-list, .users-list, .ads-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
        .order-card, .user-card, .ad-card {
            background: linear-gradient(145deg, rgba(18,22,35,0.85), rgba(10,12,21,0.9));
            backdrop-filter: blur(10px);
            border: 1px solid rgba(0,212,255,0.1);
            border-radius: 1.2rem;
            padding: 14px;
            transition: all 0.2s;
        }
        .ad-card img {
            width: 100%;
            border-radius: 12px;
            margin-bottom: 10px;
            max-height: 100px;
            object-fit: cover;
        }
        .add-product-btn {
            background: var(--emerald);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 40px;
            font-size: 0.7rem;
            cursor: pointer;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .product-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
        .product-card {
            background: linear-gradient(145deg, rgba(18,22,35,0.85), rgba(10,12,21,0.9));
            backdrop-filter: blur(10px);
            border: 1px solid rgba(0,212,255,0.1);
            border-radius: 1.2rem;
            padding: 14px;
            transition: all 0.2s;
        }
        .custom-alert {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.95);
            backdrop-filter: blur(20px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 3000;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }
        .custom-alert.active { opacity: 1; visibility: visible; }
        .alert-card {
            background: linear-gradient(145deg, #0f111a, #0a0c15);
            border-radius: 1.5rem;
            width: 90%;
            max-width: 400px;
            padding: 1.5rem;
            border: 1px solid rgba(0,212,255,0.3);
            text-align: center;
            transform: scale(0.9);
            transition: transform 0.3s ease;
        }
        .custom-alert.active .alert-card { transform: scale(1); }
        .alert-icon {
            width: 70px;
            height: 70px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 2rem;
        }
        .alert-icon.warning { background: rgba(245,158,11,0.15); color: var(--amber); border: 2px solid var(--amber); }
        .alert-icon.danger { background: rgba(244,63,94,0.15); color: var(--rose); border: 2px solid var(--rose); }
        .alert-title { font-size: 1.3rem; font-weight: 700; margin-bottom: 12px; }
        .alert-title.warning { color: var(--amber); }
        .alert-title.danger { color: var(--rose); }
        .alert-message { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.5; }
        .alert-items {
            background: rgba(0,0,0,0.3);
            border-radius: 1rem;
            padding: 12px;
            margin: 16px 0;
            text-align: left;
            font-size: 0.75rem;
        }
        .alert-items ul { margin-left: 20px; color: var(--text-secondary); }
        .alert-items li { margin: 6px 0; }
        .alert-buttons { display: flex; gap: 12px; margin-top: 20px; }
        .alert-btn {
            flex: 1;
            padding: 12px;
            border-radius: 60px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
        }
        .alert-btn.confirm { background: var(--rose); color: white; }
        .alert-btn.confirm:hover { background: #e11d48; transform: scale(0.98); }
        .alert-btn.cancel { background: #334155; color: white; }
        .alert-input {
            width: 100%;
            padding: 12px;
            margin: 16px 0;
            background: rgba(0,0,0,0.5);
            border: 1px solid #2d3a5e;
            border-radius: 60px;
            color: white;
            text-align: center;
            font-size: 0.9rem;
        }
        .checkbox-label { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 12px 0; font-size: 0.75rem; cursor: pointer; }
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.95);
            backdrop-filter: blur(20px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            display: none;
        }
        .modal.active { display: flex; }
        .modal-card {
            background: var(--bg-deep);
            border-radius: 1.5rem;
            width: 90%;
            max-width: 480px;
            padding: 1.5rem;
            border: 1px solid rgba(0,212,255,0.3);
        }
        .modal-card input, .modal-card select, .modal-card textarea {
            width: 100%;
            padding: 12px;
            margin: 8px 0 16px;
            background: rgba(0,0,0,0.5);
            border: 1px solid #2d3a5e;
            border-radius: 60px;
            color: white;
        }
        .modal-card textarea {
            border-radius: 1rem;
            resize: vertical;
        }
        .modal-btn { padding: 10px 20px; border-radius: 60px; font-weight: 600; cursor: pointer; border: none; }
        .modal-btn.save { background: var(--emerald); color: white; }
        .modal-btn.cancel { background: #334155; color: white; }
        .image-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.96);
            backdrop-filter: blur(20px);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            visibility: hidden;
            opacity: 0;
            transition: all 0.3s;
        }
        .image-modal.active { visibility: visible; opacity: 1; }
        .image-modal-content {
            max-width: 90%;
            max-height: 90%;
            background: rgba(18,22,35,0.95);
            border-radius: 24px;
            padding: 10px;
            border: 1px solid rgba(0,212,255,0.5);
        }
        .image-modal-content img { max-width: 100%; max-height: 70vh; border-radius: 16px; }
        .login-box {
            max-width: 350px;
            margin: 80px auto;
            background: linear-gradient(145deg, rgba(18,22,35,0.95), rgba(10,12,21,0.98));
            backdrop-filter: blur(20px);
            border: 1px solid rgba(0,212,255,0.4);
            border-radius: 2rem;
            padding: 2rem;
            text-align: center;
        }
        .login-box input {
            width: 100%;
            padding: 12px;
            margin: 12px 0;
            background: rgba(0,0,0,0.5);
            border: 1px solid #2d3a5e;
            border-radius: 60px;
            color: white;
        }
        .login-btn {
            background: linear-gradient(135deg, var(--cyan), #0891b2);
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 60px;
            font-weight: 700;
            cursor: pointer;
        }
        .loading { text-align: center; padding: 2rem; color: #64748b; }
        .last-update { font-size: 0.6rem; color: #475569; text-align: center; padding: 12px; }
        .toast {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--emerald);
            color: #030712;
            padding: 10px 20px;
            border-radius: 60px;
            font-size: 0.8rem;
            z-index: 1000;
            display: none;
            white-space: nowrap;
        }
        .hidden { display: none; }
        
        /* Sales Hours Control Styles */
        .sales-hours-card {
            background: linear-gradient(145deg, rgba(18,22,35,0.9), rgba(10,12,21,0.95));
            backdrop-filter: blur(10px);
            border: 1px solid rgba(0,212,255,0.15);
            border-radius: 1.2rem;
            padding: 12px;
            margin-bottom: 16px;
        }
        .sales-hours-title {
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--cyan);
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .sales-hours-controls {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: center;
            justify-content: center;
        }
        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 50px;
            height: 24px;
        }
        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #334155;
            transition: .3s;
            border-radius: 34px;
        }
        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .3s;
            border-radius: 50%;
        }
        input:checked + .toggle-slider {
            background: linear-gradient(135deg, var(--cyan), #0891b2);
        }
        input:checked + .toggle-slider:before {
            transform: translateX(26px);
        }
        .hour-select {
            background: rgba(0,0,0,0.5);
            border: 1px solid #2d3a5e;
            border-radius: 40px;
            padding: 6px 12px;
            color: white;
            font-size: 0.7rem;
            cursor: pointer;
        }
        .hour-select:focus {
            outline: none;
            border-color: var(--cyan);
        }
        .sales-status {
            font-size: 0.65rem;
            padding: 8px;
            border-radius: 40px;
            text-align: center;
            margin-top: 12px;
        }
        .sales-status.open {
            background: rgba(16,185,129,0.15);
            color: #34d399;
        }
        .sales-status.closed {
            background: rgba(244,63,94,0.15);
            color: #fb7185;
        }
        
        .notification-bell {
            position: relative;
            display: inline-block;
        }
        .notification-bell .top-icon-btn {
            background: rgba(10,12,21,0.5);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 1px solid rgba(0,212,255,0.2);
        }
        .notification-bell .top-icon-btn:hover {
            background: rgba(0,212,255,0.15);
            transform: scale(1.05);
            border-color: rgba(0,212,255,0.5);
        }
        .notification-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background: linear-gradient(135deg, #f43f5e, #e11d48);
            color: white;
            font-size: 0.6rem;
            font-weight: bold;
            min-width: 18px;
            height: 18px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 5px;
            box-shadow: 0 0 0 2px #0a0c15;
            z-index: 10;
        }
        .notification-dropdown {
            position: absolute;
            top: 55px;
            right: 0;
            width: 380px;
            max-width: calc(100vw - 20px);
            background: linear-gradient(145deg, #1a1d2e, #0f111a);
            border-radius: 1rem;
            border: 1px solid rgba(0,212,255,0.25);
            box-shadow: 0 20px 35px -10px rgba(0,0,0,0.5);
            z-index: 10000;
            overflow: hidden;
            display: none;
            backdrop-filter: blur(10px);
        }
        .notification-dropdown.show { display: block; }
        .notification-header {
            padding: 16px 20px;
            border-bottom: 1px solid rgba(0,212,255,0.15);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(0,212,255,0.03);
        }
        .notification-header h4 {
            font-size: 0.9rem;
            color: var(--cyan);
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 0;
        }
        .notification-clear {
            font-size: 0.7rem;
            background: rgba(0,212,255,0.12);
            border: 1px solid rgba(0,212,255,0.3);
            padding: 6px 14px;
            border-radius: 40px;
            color: var(--cyan);
            cursor: pointer;
        }
        .notification-list {
            max-height: 450px;
            overflow-y: auto;
        }
        .notification-item {
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            display: flex;
            gap: 14px;
            align-items: flex-start;
            cursor: pointer;
        }
        .notification-item.unread {
            background: rgba(0,212,255,0.08);
            border-left: 3px solid var(--cyan);
        }
        .notification-icon {
            width: 42px;
            height: 42px;
            background: linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05));
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.1rem;
            color: var(--cyan);
            flex-shrink: 0;
        }
        .notification-content { flex: 1; }
        .notification-title { font-size: 0.85rem; font-weight: 700; margin-bottom: 5px; color: var(--text-primary); }
        .notification-message { font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 6px; }
        .notification-time { font-size: 0.6rem; color: #5b6e8c; }
        .notification-delete {
            opacity: 0;
            background: rgba(244,63,94,0.15);
            border: none;
            color: #fb7185;
            width: 30px;
            height: 30px;
            border-radius: 8px;
            cursor: pointer;
        }
        .notification-item:hover .notification-delete { opacity: 1; }
        .notification-empty { text-align: center; padding: 50px 20px; color: var(--text-secondary); }
        .notification-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.4);
            backdrop-filter: blur(3px);
            z-index: 9999;
            display: none;
        }
        .notification-overlay.show { display: block; }
        
        /* Ad card specific styles */
        .ad-status-active { background: #10b981; color: white; display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 0.65rem; margin-bottom: 10px; }
        .ad-status-inactive { background: #64748b; color: white; display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 0.65rem; margin-bottom: 10px; }
        .ad-status-expired { background: #f43f5e; color: white; display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 0.65rem; margin-bottom: 10px; }
        .ad-card-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .ad-card-actions button { flex: 1; padding: 8px; border-radius: 40px; font-size: 0.7rem; font-weight: 600; cursor: pointer; border: none; }
        .ad-edit-btn { background: rgba(0,212,255,0.2); color: var(--cyan); }
        .ad-toggle-btn { background: rgba(245,158,11,0.2); color: #fbbf24; }
        .ad-delete-btn { background: rgba(244,63,94,0.2); color: #fb7185; }
        
        @media (max-width: 480px) {
            .notification-dropdown {
                position: fixed;
                top: 65px;
                left: 10px;
                right: 10px;
                width: auto;
            }
            .sales-hours-controls {
                flex-direction: column;
                align-items: stretch;
            }
            .hour-select {
                width: 100%;
            }
        }
    </style>
</head>
<body>
<div id="app">
    <div id="notificationOverlay" class="notification-overlay"></div>
    
    <div class="container" id="adminContent" style="display: none;">
        <div class="top-bar">
            <div class="top-bar-left">
                <button class="menu-btn" onclick="window.toggleDrawer()">
                    <i class="fas fa-bars"></i>
                </button>
                <div class="logo">
                    <i class="fas fa-crown"></i> ATH Admin
                </div>
            </div>
            <div class="top-bar-right">
                <button class="top-icon-btn" onclick="window.manualRefresh()" title="Sync Data">
                    <i class="fas fa-sync-alt"></i>
                </button>
                
                <div class="notification-bell">
                    <button class="top-icon-btn" id="notificationBellBtn" title="Notifications">
                        <i class="fas fa-bell"></i>
                        <span id="notificationBadge" class="notification-badge" style="display: none;">0</span>
                    </button>
                    <div id="notificationDropdown" class="notification-dropdown">
                        <div class="notification-header">
                            <h4><i class="fas fa-bell"></i> အကြောင်းကြားချက်များ</h4>
                            <button class="notification-clear" id="clearNotificationsBtn"><i class="fas fa-trash-alt"></i> အားလုံးရှင်း</button>
                        </div>
                        <div id="notificationList" class="notification-list">
                            <div class="notification-empty"><i class="fas fa-spinner fa-pulse"></i> ဖွင့်နေသည်...</div>
                        </div>
                    </div>
                </div>
                
                <button class="top-icon-btn" onclick="window.location.href='/'" title="Go to Store">
                    <i class="fas fa-store"></i>
                </button>
                <button class="top-icon-btn" onclick="openAdminChatWidget()" title="Chat Support">
                    <i class="fas fa-comments"></i>
                </button>
            </div>
        </div>
        
        <div id="drawerOverlay" class="drawer-overlay" onclick="window.closeDrawer()"></div>
        <div id="drawer" class="drawer">
            <div class="drawer-header">
                <div class="drawer-avatar"><i class="fas fa-user-shield"></i></div>
                <div class="drawer-title">အဒ်မင် အကန့်</div>
                <div class="drawer-subtitle">ATH DIGITAL HUB</div>
            </div>
            <div class="drawer-stats">
                <div class="drawer-stats-title"><i class="fas fa-database"></i> ဒေတာဘေ့စ် စာရင်းအင်း</div>
                <div class="drawer-stat-item"><span class="drawer-stat-label"><i class="fas fa-shopping-cart"></i> စုစုပေါင်း အမိန့်စာ</span><span class="drawer-stat-value" id="drawerTotalOrders">0</span></div>
                <div class="drawer-stat-item"><span class="drawer-stat-label"><i class="fas fa-users"></i> စုစုပေါင်း အသုံးပြုသူ</span><span class="drawer-stat-value" id="drawerTotalUsers">0</span></div>
                <div class="drawer-stat-item"><span class="drawer-stat-label"><i class="fas fa-clock"></i> ဆိုင်းငံ့ထားသော အမိန့်စာ</span><span class="drawer-stat-value" id="drawerPendingOrders">0</span></div>
                <div class="drawer-stat-item"><span class="drawer-stat-label"><i class="fas fa-check-circle"></i> အတည်ပြုပြီး အမိန့်စာ</span><span class="drawer-stat-value" id="drawerApprovedOrders">0</span></div>
                <div class="drawer-stat-item"><span class="drawer-stat-label"><i class="fas fa-times-circle"></i> ပယ်ချထားသော အမိန့်စာ</span><span class="drawer-stat-value" id="drawerRejectedOrders">0</span></div>
                <div class="drawer-stat-item"><span class="drawer-stat-label"><i class="fas fa-coins"></i> စုစုပေါင်း ဝင်ငွေ</span><span class="drawer-stat-value" id="drawerTotalRevenue">0</span></div>
                <div class="drawer-stat-item"><span class="drawer-stat-label"><i class="fas fa-chart-line"></i> စုစုပေါင်း အမြတ်</span><span class="drawer-stat-value" id="drawerTotalProfit">0</span></div>
            </div>
            <div class="drawer-stats-title" style="margin-top: 10px;"><i class="fas fa-bars"></i> မီနူး</div>
            <ul class="drawer-menu">
                <li><a onclick="window.closeDrawer(); window.switchTab('menu')"><i class="fas fa-chart-line"></i> မီနူး</a></li>
                <li><a onclick="window.closeDrawer(); window.switchTab('orders')"><i class="fas fa-list-ul"></i> အမိန့်စာများ</a></li>
                <li><a onclick="window.closeDrawer(); window.switchTab('users')"><i class="fas fa-users"></i> အသုံးပြုသူများ</a></li>
                <li><a onclick="window.closeDrawer(); window.switchTab('market')"><i class="fas fa-store"></i> စတိုးဆိုင်</a></li>
                <li><a onclick="window.closeDrawer(); window.switchTab('ads')"><i class="fas fa-ad"></i> ကြော်ငြာများ</a></li>
                <li><a onclick="window.closeDrawer(); openAdminChatWidget()"><i class="fas fa-comments"></i> စကားဝိုင်း</a></li>
                <li><div class="drawer-divider"></div></li>
                <li><a onclick="window.closeDrawer(); window.exportUsersToCSV()"><i class="fas fa-file-excel"></i> အသုံးပြုသူများ တင်ပို့ခြင်း (CSV)</a></li>
                <li><a onclick="window.closeDrawer(); window.exportOrdersToCSV()"><i class="fas fa-file-excel"></i> အမိန့်စာများ တင်ပို့ခြင်း (CSV)</a></li>
                <li><div class="drawer-divider"></div></li>
                <li><a onclick="window.closeDrawer(); window.showCleanupAlert()"><i class="fas fa-trash-alt"></i> အမိန့်စာဟောင်းများ ရှင်းလင်းခြင်း</a></li>
                <li><a onclick="window.closeDrawer(); window.showSystemResetAlert()" style="color: #f43f5e;"><i class="fas fa-database"></i> စနစ်ပြန်လည်သတ်မှတ်ခြင်း (အန္တရာယ်ရှိ)</a></li>
                <li><div class="drawer-divider"></div></li>
                <li><a onclick="window.closeDrawer(); window.logout()"><i class="fas fa-sign-out-alt"></i> ထွက်ရန်</a></li>
            </ul>
        </div>
        
        <div id="menuTab" class="tab-content active">
            <div class="sales-hours-card">
                <div class="sales-hours-title">
                    <i class="fas fa-clock"></i> ရောင်းချချိန် သတ်မှတ်ချက်
                </div>
                
                <div style="display: flex; gap: 12px; justify-content: center; margin-bottom: 16px;">
                    <button id="autoModeBtn" onclick="setMode('auto')" style="background: linear-gradient(135deg, var(--cyan), #0891b2); color: white; border: none; padding: 6px 20px; border-radius: 40px; cursor: pointer; font-size: 0.7rem; font-weight: 600;">
                        <i class="fas fa-robot"></i> အလိုအလျောက်မုဒ်
                    </button>
                    <button id="manualModeBtn" onclick="setMode('manual')" style="background: rgba(0,212,255,0.2); color: var(--cyan); border: 1px solid rgba(0,212,255,0.3); padding: 6px 20px; border-radius: 40px; cursor: pointer; font-size: 0.7rem; font-weight: 600;">
                        <i class="fas fa-hand-pointer"></i> လက်ဖြင့်မုဒ်
                    </button>
                </div>
                
                <div id="autoModeControls" class="sales-hours-controls">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 0.7rem;">ဖွင့်/ပိတ်:</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="salesEnabled" onchange="updateSalesHours()">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.7rem;">စတင်ချိန်:</span>
                        <select id="startHour" class="hour-select" onchange="updateSalesHours()">
                            <option value="0">12 ည</option><option value="1">1 နံနက်</option><option value="2">2 နံနက်</option>
                            <option value="3">3 နံနက်</option><option value="4">4 နံနက်</option><option value="5">5 နံနက်</option>
                            <option value="6">6 နံနက်</option><option value="7">7 နံနက်</option><option value="8">8 နံနက်</option>
                            <option value="9">9 နံနက်</option><option value="10">10 နံနက်</option><option value="11">11 နံနက်</option>
                            <option value="12">12 မွန်းတည့်</option><option value="13">1 ညနေ</option><option value="14">2 ညနေ</option>
                            <option value="15">3 ညနေ</option><option value="16">4 ညနေ</option><option value="17">5 ညနေ</option>
                            <option value="18">6 ညနေ</option><option value="19">7 ညနေ</option><option value="20">8 ညနေ</option>
                            <option value="21">9 ညနေ</option><option value="22">10 ညနေ</option><option value="23">11 ညနေ</option>
                        </select>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.7rem;">ပိတ်ချိန်:</span>
                        <select id="endHour" class="hour-select" onchange="updateSalesHours()">
                            <option value="0">12 ည</option><option value="1">1 နံနက်</option><option value="2">2 နံနက်</option>
                            <option value="3">3 နံနက်</option><option value="4">4 နံနက်</option><option value="5">5 နံနက်</option>
                            <option value="6">6 နံနက်</option><option value="7">7 နံနက်</option><option value="8">8 နံနက်</option>
                            <option value="9">9 နံနက်</option><option value="10">10 နံနက်</option><option value="11">11 နံနက်</option>
                            <option value="12">12 မွန်းတည့်</option><option value="13">1 ညနေ</option><option value="14">2 ညနေ</option>
                            <option value="15">3 ညနေ</option><option value="16">4 ညနေ</option><option value="17">5 ညနေ</option>
                            <option value="18">6 ညနေ</option><option value="19">7 ညနေ</option><option value="20">8 ညနေ</option>
                            <option value="21">9 ညနေ</option><option value="22">10 ညနေ</option><option value="23">11 ညနေ</option>
                        </select>
                    </div>
                </div>
                
                <div id="manualModeControls" style="display: none; text-align: center; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 15px; flex-wrap: wrap;">
                        <span style="font-size: 0.7rem;">ဆိုင်အခြေအနေ:</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="manualToggle" onchange="toggleManualShop()">
                            <span class="toggle-slider"></span>
                        </label>
                        <span id="manualStatusText" style="font-size: 0.7rem; font-weight: 600; color: #34d399;">🟢 ဖွင့်ထား</span>
                    </div>
                </div>
                
                <div id="salesStatus" class="sales-status">Loading...</div>
            </div>
            
            <!-- Ad Settings Card -->
            <div class="sales-hours-card" style="margin-top: 16px;">
                <div class="sales-hours-title">
                    <i class="fas fa-ad"></i> ကြော်ငြာ ပြပုံအပြင်အဆင်
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 0.7rem;">ပြမယ့်ပုံစံ:</span>
                        <select id="adRotationMode" class="hour-select" style="width: auto;">
                            <option value="random">ကျပန်း (Random)</option>
                            <option value="weighted">အလေးချိန် (Weighted)</option>
                            <option value="roundrobin">အလှည့်ကျ (Round Robin)</option>
                        </select>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 0.7rem;">Auto လှည့် (စက္ကန့်):</span>
                        <input type="number" id="adAutoCycle" class="hour-select" style="width: 80px;" value="0" step="1" min="0">
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.7rem;">
                            <input type="checkbox" id="adShowNavigation" checked> နောက်တစ်ခုခလုတ်ပြမယ်
                        </label>
                    </div>
                    <button onclick="saveAdSettings()" style="background: rgba(0,212,255,0.15); border: 1px solid rgba(0,212,255,0.3); padding: 6px 16px; border-radius: 40px; cursor: pointer; font-size: 0.7rem;">
                        <i class="fas fa-save"></i> သိမ်းမယ်
                    </button>
                </div>
            </div>
            
            <div class="stats-grid" id="statsGrid">
                <div class="stat-card"><div class="stat-number" id="totalOrders">0</div><div class="stat-label"><i class="fas fa-shopping-cart"></i> စုစုပေါင်း အမိန့်စာ</div></div>
                <div class="stat-card"><div class="stat-number" id="pendingOrders">0</div><div class="stat-label"><i class="fas fa-clock"></i> ဆိုင်းငံ့ထားသော</div></div>
                <div class="stat-card"><div class="stat-number" id="approvedOrders">0</div><div class="stat-label"><i class="fas fa-check-circle"></i> အတည်ပြုပြီး</div></div>
                <div class="stat-card"><div class="stat-number" id="rejectedOrders">0</div><div class="stat-label"><i class="fas fa-times-circle"></i> ပယ်ချထားသော</div></div>
                <div class="stat-card"><div class="stat-number" id="totalRevenue">0</div><div class="stat-label"><i class="fas fa-coins"></i> ဝင်ငွေ</div></div>
                <div class="stat-card"><div class="stat-number cost" id="totalCost">0</div><div class="stat-label"><i class="fas fa-boxes"></i> ကုန်ကျစရိတ်</div></div>
                <div class="stat-card"><div class="stat-number profit" id="totalProfit">0</div><div class="stat-label"><i class="fas fa-chart-line"></i> အမြတ်</div></div>
                <div class="stat-card"><div class="stat-number" id="avgProfit">0</div><div class="stat-label"><i class="fas fa-percent"></i> ပျမ်းမျှအမြတ်</div></div>
            </div>
        </div>
        
        <div id="ordersTab" class="tab-content">
            <div class="search-bar">
                <input type="text" id="searchInput" class="search-input" placeholder="🔍 ဖုန်းနံပါတ်၊ အသုံးပြုသူ ID သို့မဟုတ် အမည်ဖြင့် ရှာဖွေရန်">
                <button class="search-btn" onclick="window.searchByPhoneOrId()"><i class="fas fa-search"></i> ရှာဖွေရန်</button>
                <button class="clear-search" onclick="window.clearSearch()"><i class="fas fa-times"></i> ရှင်းလင်းရန်</button>
            </div>
            <div class="filter-bar">
                <div class="filter-group">
                    <input type="date" id="startDate" class="filter-input" placeholder="စတင်ရက်">
                    <input type="date" id="endDate" class="filter-input" placeholder="ပြီးဆုံးရက်">
                    <select id="statusFilter" class="filter-input">
                        <option value="all">အားလုံး</option>
                        <option value="Pending">ဆိုင်းငံ့ထားသော</option>
                        <option value="Approved">အတည်ပြုပြီး</option>
                        <option value="Rejected">ပယ်ချထားသော</option>
                    </select>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="filter-btn" onclick="window.applyFilters()"><i class="fas fa-filter"></i> စစ်ထုတ်ရန်</button>
                    <button class="filter-btn" onclick="window.clearFilters()" style="background:#334155;"><i class="fas fa-undo"></i></button>
                </div>
            </div>
            <div class="orders-list" id="ordersList"><div class="loading"><i class="fas fa-spinner fa-pulse"></i> အမိန့်စာများ ဖွင့်နေသည်...</div></div>
        </div>
        
        <div id="usersTab" class="tab-content">
            <div class="search-bar">
                <input type="text" id="userSearchInput" class="search-input" placeholder="🔍 ဖုန်းနံပါတ်၊ အသုံးပြုသူ ID သို့မဟုတ် အမည်ဖြင့် ရှာဖွေရန်">
                <button class="search-btn" onclick="window.searchUsers()"><i class="fas fa-search"></i> ရှာဖွေရန်</button>
                <button class="clear-search" onclick="window.clearUserSearch()"><i class="fas fa-times"></i> ရှင်းလင်းရန်</button>
            </div>
            <div class="users-list" id="usersList"><div class="loading"><i class="fas fa-spinner fa-pulse"></i> အသုံးပြုသူများ ဖွင့်နေသည်...</div></div>
        </div>
        
        <div id="marketTab" class="tab-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3><i class="fas fa-store"></i> ထုတ်ကုန်များ</h3>
                <button class="add-product-btn" onclick="window.openAddProductModal()"><i class="fas fa-plus"></i> ထုတ်ကုန်ထည့်ရန်</button>
            </div>
            <div class="product-list" id="productList"><div class="loading"><i class="fas fa-spinner fa-pulse"></i> ထုတ်ကုန်များ ဖွင့်နေသည်...</div></div>
        </div>
        
        <!-- Ads Tab (New) -->
        <div id="adsTab" class="tab-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3><i class="fas fa-ad"></i> ကြော်ငြာများ</h3>
                <button class="add-product-btn" onclick="openAddAdModal()"><i class="fas fa-plus"></i> ကြော်ငြာအသစ်</button>
            </div>
            <div class="ads-list" id="adsList"><div class="loading"><i class="fas fa-spinner fa-pulse"></i> ကြော်ငြာများ ဖွင့်နေသည်...</div></div>
        </div>
        
        <div class="last-update" id="lastUpdate"></div>
    </div>
    
    <div class="bottom-nav" id="bottomNav" style="display: none;">
        <button class="nav-item" data-tab="menu"><i class="fas fa-chart-line"></i><span>မီနူး</span></button>
        <button class="nav-item" data-tab="orders"><i class="fas fa-list-ul"></i><span>အမိန့်စာများ</span></button>
        <button class="nav-item" data-tab="users"><i class="fas fa-users"></i><span>အသုံးပြုသူများ</span></button>
        <button class="nav-item" data-tab="market"><i class="fas fa-store"></i><span>စတိုးဆိုင်</span></button>
        <button class="nav-item" data-tab="ads"><i class="fas fa-ad"></i><span>ကြော်ငြာများ</span></button>
        <button class="nav-item" data-tab="chat" onclick="openAdminChatWidget()"><i class="fas fa-comments"></i><span>စကားဝိုင်း</span></button>
    </div>
    
    <div id="loginBox" class="login-box">
        <i class="fas fa-lock" style="font-size: 2rem; color: var(--cyan); margin-bottom: 1rem;"></i>
        <h2>အဒ်မင် ဝင်ရောက်ရန်</h2>
        <input type="password" id="adminPassword" placeholder="စကားဝှက် ထည့်သွင်းပါ">
        <button class="login-btn" onclick="window.login()"><i class="fas fa-unlock-alt"></i> ဝင်ရောက်ရန်</button>
    </div>
</div>

<div id="cleanupAlert" class="custom-alert">
    <div class="alert-card">
        <div class="alert-icon warning"><i class="fas fa-trash-alt"></i></div>
        <div class="alert-title warning">⚠️ အမိန့်စာဟောင်းများ ရှင်းလင်းခြင်း</div>
        <div class="alert-message">ရက် ၃၀ ကျော် ဆိုင်းငံ့ထားသော/ပယ်ချထားသော အမိန့်စာများအားလုံးကို ဖျက်လိုပါသလား။</div>
        <div class="alert-items"><ul><li>❌ ရက် ၃၀ ကျော် ဆိုင်းငံ့ထားသော အမိန့်စာများ</li><li>❌ ရက် ၃၀ ကျော် ပယ်ချထားသော အမိန့်စာများ</li><li>✅ အတည်ပြုပြီး အမိန့်စာများကို ထိန်းသိမ်းမည်</li><li>✅ ထုတ်ကုန်များ ထိခိုက်မည်မဟုတ်</li></ul></div>
        <div class="alert-buttons"><button class="alert-btn confirm" onclick="window.executeCleanup()">ဟုတ်ကဲ့၊ ဖျက်မည်</button><button class="alert-btn cancel" onclick="window.closeCleanupAlert()">မလုပ်တော့ပါ</button></div>
    </div>
</div>

<div id="systemResetAlert" class="custom-alert">
    <div class="alert-card">
        <div class="alert-icon danger"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="alert-title danger">⚠️ စနစ်ပြန်လည်သတ်မှတ်ခြင်း</div>
        <div class="alert-message">ဤလုပ်ဆောင်ချက်ကို <strong>ပြန်လည်ဖျက်လို့မရပါ!</strong> အတည်ပြုရန် <strong style="color:#f43f5e;">"RESET_ALL_DATA"</strong> ဟု ရိုက်ထည့်ပါ။</div>
        <div class="alert-items"><ul><li>❌ အသုံးပြုသူအားလုံး ဖျက်မည်</li><li>❌ အမိန့်စာအားလုံး ဖျက်မည်</li><li>❌ အသုံးပြုသူစာရင်းအင်းအားလုံး ဖျက်မည်</li><li>❌ တင်ထားသော ဖန်သားပြင်ဓာတ်ပုံများအားလုံး ဖျက်မည်</li><li>✅ ထုတ်ကုန်များကို ထိန်းသိမ်းမည် (အောက်တွင် ရွေးချယ်နိုင်သည်)</li></ul></div>
        <input type="text" id="resetConfirmInput" class="alert-input" placeholder='"RESET_ALL_DATA" ဟု ရိုက်ထည့်ပါ'>
        <label class="checkbox-label"><input type="checkbox" id="keepProductsCheckbox" checked> ထုတ်ကုန်များကို ထိန်းသိမ်းမည် (မဖျက်ရန်)</label>
        <div class="alert-buttons"><button class="alert-btn confirm" onclick="window.executeSystemResetFromAlert()">ဟုတ်ကဲ့၊ အားလုံးပြန်လည်သတ်မှတ်မည်</button><button class="alert-btn cancel" onclick="window.closeSystemResetAlert()">မလုပ်တော့ပါ</button></div>
    </div>
</div>

<div id="productModal" class="modal">
    <div class="modal-card">
        <h3 id="productModalTitle">ထုတ်ကုန်ထည့်ရန်</h3>
        <input type="text" id="productName" placeholder="ထုတ်ကုန်အမည် *">
        <input type="number" id="productPrice" placeholder="စျေးနှုန်း (MMK) *">
        <input type="text" id="productImage" placeholder="ပုံ URL (ရွေးချယ်နိုင်သည်)">
        <input type="text" id="productCategory" placeholder="အမျိုးအစား">
        <input type="text" id="productIcon" placeholder="အိုင်ကွန် (ဥပမာ- fas fa-tshirt)">
        <input type="number" id="productDiscount" placeholder="လျှော့စျေး %">
        <div style="display: flex; gap: 12px; margin-top: 16px;">
            <button class="modal-btn save" onclick="window.saveProduct()">သိမ်းရန်</button>
            <button class="modal-btn cancel" onclick="window.closeProductModal()">မလုပ်တော့ပါ</button>
        </div>
    </div>
</div>

<!-- Ad Modal (New) -->
<div id="adModal" class="modal">
    <div class="modal-card">
        <h3 id="adModalTitle">ကြော်ငြာအသစ်ထည့်ရန်</h3>
        <input type="text" id="adName" placeholder="ကြော်ငြာအမည် *">
        <input type="text" id="adImageUrl" placeholder="ပုံ URL *">
        <input type="text" id="adDestinationUrl" placeholder="Website Link *">
        <textarea id="adAltText" placeholder="စာသား (ရွေးချယ်နိုင်သည်)" rows="2"></textarea>
        <input type="number" id="adDisplayWeight" placeholder="အလေးချိန် (1-20)" value="5">
        <input type="date" id="adExpiryDate" placeholder="သက်တမ်းကုန်ဆုံးရက်">
        <div style="display: flex; gap: 12px; margin-top: 16px;">
            <button class="modal-btn save" onclick="saveAd()">သိမ်းရန်</button>
            <button class="modal-btn cancel" onclick="closeAdModal()">မလုပ်တော့ပါ</button>
        </div>
    </div>
</div>

<div id="screenshotModal" class="image-modal" onclick="window.closeModal()">
    <div class="image-modal-content" onclick="event.stopPropagation()">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid rgba(0,212,255,0.2);">
            <span><i class="fas fa-image"></i> ငွေပေးချေမှု ဖန်သားပြင်ဓာတ်ပုံ</span>
            <button class="close-modal" onclick="window.closeModal()" style="background:rgba(255,255,255,0.1); border:none; color:white; width:30px; height:30px; border-radius:50%; cursor:pointer;">&times;</button>
        </div>
        <img id="modalImage" src="" alt="Screenshot">
    </div>
</div>

<div id="toast" class="toast"></div>

<script>
// ==================== MAIN SCRIPT (Original + Ads Added) ====================
(function() {
    const API_BASE = window.location.origin;
    let token = localStorage.getItem('adminToken');
    let allOrders = [], userStats = [], products = [];
    let autoSyncInterval = null;
    let activeCountdowns = {};
    let currentSearchPhone = "";
    let currentUserSearchPhone = "";
    let currentTab = "menu";
    let editingProductId = null;
    
    // ============ AD MANAGEMENT VARIABLES ============
    let allAds = [];
    let editingAdId = null;
    
    const costPriceMap = {
        "VIP LEVEL - 1": 14500,
        "VIP LEVEL - 2": 19500,
        "VIP LEVEL - 3": 24500,
        "VIP LEVEL - 4 (ULTRA)": 29000
    };
    
    function getCostPrice(plan) { return costPriceMap[plan] || 0; }
    function getProfit(price, plan) { return price - getCostPrice(plan); }
    
    function maskPhone(phone) {
        if (!phone || phone.length < 8) return phone || '';
        return phone.substring(0, 5) + '***' + phone.substring(phone.length - 3);
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    function showToast(msg, isError) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.style.background = isError ? '#f43f5e' : '#10b981';
        toast.style.display = 'block';
        setTimeout(() => { if (toast) toast.style.display = 'none'; }, 2500);
    }
    
    window.copyToClipboard = function(text) {
        navigator.clipboard.writeText(text);
        showToast(`📋 ${text} ကူးယူပြီးပါပြီ။`);
    };
    
    async function fetchWithRetry(url, options = {}, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url, options);
                if (res.status === 401 && url.includes('/api/admin/')) {
                    console.log('Session expired, please login again');
                    window.logout();
                    return null;
                }
                return res;
            } catch (e) {
                if (i === retries - 1) throw e;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }
    
    function updateAllStats() {
        if (!allOrders || !Array.isArray(allOrders)) allOrders = [];
        const total = allOrders.length;
        const pendingOrders = allOrders.filter(o => o && o.status === 'Pending');
        const approvedOrders = allOrders.filter(o => o && o.status === 'Approved');
        const rejectedOrders = allOrders.filter(o => o && o.status === 'Rejected');
        const pending = pendingOrders.length;
        const approved = approvedOrders.length;
        const rejected = rejectedOrders.length;
        const revenue = approvedOrders.reduce((s, o) => s + (o.price || 0), 0);
        const cost = approvedOrders.reduce((s, o) => s + getCostPrice(o.plan || ''), 0);
        const profit = revenue - cost;
        
        const totalOrdersEl = document.getElementById('totalOrders');
        if (totalOrdersEl) totalOrdersEl.innerHTML = total;
        const pendingOrdersEl = document.getElementById('pendingOrders');
        if (pendingOrdersEl) pendingOrdersEl.innerHTML = pending;
        const approvedOrdersEl = document.getElementById('approvedOrders');
        if (approvedOrdersEl) approvedOrdersEl.innerHTML = approved;
        const rejectedOrdersEl = document.getElementById('rejectedOrders');
        if (rejectedOrdersEl) rejectedOrdersEl.innerHTML = rejected;
        const totalRevenueEl = document.getElementById('totalRevenue');
        if (totalRevenueEl) totalRevenueEl.innerHTML = revenue.toLocaleString() + 'K';
        const totalCostEl = document.getElementById('totalCost');
        if (totalCostEl) totalCostEl.innerHTML = cost.toLocaleString() + 'K';
        const totalProfitEl = document.getElementById('totalProfit');
        if (totalProfitEl) totalProfitEl.innerHTML = profit.toLocaleString() + 'K';
        const avgProfitEl = document.getElementById('avgProfit');
        if (avgProfitEl) avgProfitEl.innerHTML = (approved ? Math.round(profit / approved) : 0).toLocaleString() + 'K';
        
        const drawerTotalOrdersEl = document.getElementById('drawerTotalOrders');
        if (drawerTotalOrdersEl) drawerTotalOrdersEl.innerText = total;
        const drawerTotalUsersEl = document.getElementById('drawerTotalUsers');
        if (drawerTotalUsersEl) drawerTotalUsersEl.innerText = userStats ? userStats.length : 0;
        const drawerPendingOrdersEl = document.getElementById('drawerPendingOrders');
        if (drawerPendingOrdersEl) drawerPendingOrdersEl.innerText = pending;
        const drawerApprovedOrdersEl = document.getElementById('drawerApprovedOrders');
        if (drawerApprovedOrdersEl) drawerApprovedOrdersEl.innerText = approved;
        const drawerRejectedOrdersEl = document.getElementById('drawerRejectedOrders');
        if (drawerRejectedOrdersEl) drawerRejectedOrdersEl.innerText = rejected;
        const drawerTotalRevenueEl = document.getElementById('drawerTotalRevenue');
        if (drawerTotalRevenueEl) drawerTotalRevenueEl.innerText = revenue.toLocaleString() + 'K';
        const drawerTotalProfitEl = document.getElementById('drawerTotalProfit');
        if (drawerTotalProfitEl) drawerTotalProfitEl.innerText = profit.toLocaleString() + 'K';
    }
    
    window.showCleanupAlert = function() { 
        const alert = document.getElementById('cleanupAlert');
        if (alert) alert.classList.add('active');
    };
    window.closeCleanupAlert = function() { 
        const alert = document.getElementById('cleanupAlert');
        if (alert) alert.classList.remove('active');
    };
    window.showSystemResetAlert = function() { 
        const input = document.getElementById('resetConfirmInput');
        const checkbox = document.getElementById('keepProductsCheckbox');
        const alert = document.getElementById('systemResetAlert');
        if (input) input.value = '';
        if (checkbox) checkbox.checked = true;
        if (alert) alert.classList.add('active');
    };
    window.closeSystemResetAlert = function() { 
        const alert = document.getElementById('systemResetAlert');
        if (alert) alert.classList.remove('active');
    };
    
    window.executeCleanup = async function() {
        window.closeCleanupAlert();
        showToast('🔄 အမိန့်စာဟောင်းများ ရှင်းလင်းနေသည်...');
        try { 
            const res = await fetchWithRetry(`${API_BASE}/api/admin/cleanup-old`, { method: 'POST' }); 
            if (!res) return;
            const data = await res.json(); 
            if (data.success) { 
                showToast(`✅ ${data.message}`); 
                loadAllData(); 
            } else { 
                showToast('❌ ရှင်းလင်းခြင်း မအောင်မြင်ပါ: ' + data.error, true); 
            } 
        } catch(e) { 
            showToast('Error: ' + e.message, true); 
        }
    };
    
    window.executeSystemResetFromAlert = async function() {
        const confirmText = document.getElementById('resetConfirmInput')?.value.trim() || '';
        const keepProducts = document.getElementById('keepProductsCheckbox')?.checked || true;
        if (confirmText !== 'RESET_ALL_DATA') { 
            showToast('အတည်ပြုရန် "RESET_ALL_DATA" ဟု ရိုက်ထည့်ပါ', true); 
            return; 
        }
        window.closeSystemResetAlert();
        showToast('🔄 စနစ်ပြန်လည်သတ်မှတ်နေသည်... ကျေးဇူးပြု၍ စောင့်ပါ...');
        try { 
            const res = await fetchWithRetry(`${API_BASE}/api/admin/system-reset`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ confirm: confirmText, keepProducts }) 
            }); 
            if (!res) return;
            const data = await res.json(); 
            if (data.success) { 
                showToast('✅ စနစ်ပြန်လည်သတ်မှတ်ခြင်း ပြီးစီးပါပြီ။'); 
                setTimeout(() => { loadAllData(); }, 1000); 
            } else { 
                showToast('❌ ပြန်လည်သတ်မှတ်ခြင်း မအောင်မြင်ပါ: ' + data.error, true); 
            } 
        } catch(e) { 
            showToast('Error: ' + e.message, true); 
        }
    };
    
    window.openScreenshot = function(url) {
        const modal = document.getElementById('screenshotModal');
        const img = document.getElementById('modalImage');
        if (modal && img) {
            if (url && url !== 'null') { 
                img.src = url.startsWith('/') ? API_BASE + url : url; 
            } else { 
                img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%231a1a2e"/%3E%3Ctext x="200" y="150" text-anchor="middle" fill="%2364748b" font-size="14"%3Eပုံမရှိပါ%3C/text%3E%3C/svg%3E'; 
            }
            modal.classList.add('active');
        }
    };
    window.closeModal = function() { 
        const modal = document.getElementById('screenshotModal');
        if (modal) modal.classList.remove('active');
    };
    
    function getPaymentIcon(method) { 
        const icons = { 
            'kpay': '<i class="fas fa-university" style="color:#1e88e5;"></i> KBZ Pay', 
            'wavepay': '<i class="fas fa-waveform" style="color:#43a047;"></i> WavePay', 
            'ayapay': '<i class="fas fa-building" style="color:#f9a825;"></i> AYA Pay' 
        }; 
        return icons[method] || icons['kpay']; 
    }
    
    function getRemainingTime(activatedAt) {
        if (!activatedAt) return null;
        const now = Date.now();
        const endDate = new Date(activatedAt).getTime() + (30 * 24 * 60 * 60 * 1000);
        const remaining = endDate - now;
        if (remaining <= 0) return "Expired";
        const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
        const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        return { days, hours, minutes };
    }
    
    function formatCountdown(activatedAt) { 
        const time = getRemainingTime(activatedAt); 
        if (!time) return null; 
        if (time === "Expired") return "သက်တမ်းကုန်ဆုံးပြီ"; 
        return `${time.days}ရက် ${time.hours}နာရီ ${time.minutes}မိနစ်`; 
    }
    
    function startCountdownForOrder(orderId, activatedAt) {
        if (activeCountdowns[orderId]) { 
            clearInterval(activeCountdowns[orderId]); 
            delete activeCountdowns[orderId]; 
        }
        const interval = setInterval(() => {
            const elem = document.getElementById(`countdown-${orderId}`);
            if (!elem) { 
                clearInterval(interval); 
                delete activeCountdowns[orderId]; 
                return; 
            }
            const formatted = formatCountdown(activatedAt);
            if (formatted === "သက်တမ်းကုန်ဆုံးပြီ") { 
                elem.innerHTML = `<i class="fas fa-calendar-times"></i> <span style="color:#f43f5e;">သက်တမ်းကုန်ဆုံးပြီ</span>`; 
                clearInterval(interval); 
                delete activeCountdowns[orderId]; 
            } else { 
                elem.innerHTML = `<i class="fas fa-hourglass-half"></i> <span class="countdown-timer">${formatted}</span>`; 
            }
        }, 1000);
        activeCountdowns[orderId] = interval;
    }
    
    function clearAllCountdowns() { 
        for (let id in activeCountdowns) { 
            clearInterval(activeCountdowns[id]); 
        } 
        activeCountdowns = {}; 
    }
    
    function startAutoSync() {
        if (autoSyncInterval) clearInterval(autoSyncInterval);
        autoSyncInterval = setInterval(() => { 
            if (token === 'logged_in') { 
                loadAllData();
            } 
        }, 30000);
    }
    
    function stopAutoSync() { 
        if (autoSyncInterval) clearInterval(autoSyncInterval); 
    }
    
    window.login = async function() {
        const password = document.getElementById('adminPassword')?.value || '';
        if (!password) {
            showToast('စကားဝှက် ထည့်သွင်းပါ', true);
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/admin/login`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ password }),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('adminToken', 'logged_in'); 
                token = 'logged_in';
                const loginBox = document.getElementById('loginBox');
                const adminContent = document.getElementById('adminContent');
                const bottomNav = document.getElementById('bottomNav');
                if (loginBox) loginBox.style.display = 'none';
                if (adminContent) adminContent.style.display = 'block';
                if (bottomNav) bottomNav.style.display = 'flex';
                loadAllData(); 
                loadSalesHours();
                loadAdSettings();
                loadAds();
                startAutoSync(); 
            } else { 
                showToast('စကားဝှက် မှားယွင်းနေသည်', true); 
            }
        } catch(e) { 
            showToast('ချိတ်ဆက်မှု အမှား: ' + e.message, true); 
        }
    };
    
    window.logout = function() {
        stopAutoSync(); 
        clearAllCountdowns();
        closeAdminChatWidget();
        localStorage.removeItem('adminToken'); 
        token = null;
        const loginBox = document.getElementById('loginBox');
        const adminContent = document.getElementById('adminContent');
        const bottomNav = document.getElementById('bottomNav');
        if (loginBox) loginBox.style.display = 'block';
        if (adminContent) adminContent.style.display = 'none';
        if (bottomNav) bottomNav.style.display = 'none';
    };
    
    async function loadAllData() { 
        await loadOrders(); 
        await loadUserStats(); 
        await loadProducts(); 
        await loadAds();
        updateAllStats();
    }
    
    async function loadOrders() {
        try {
            const res = await fetchWithRetry(`${API_BASE}/api/admin/orders`);
            if (!res) return;
            const data = await res.json();
            if (data.orders && Array.isArray(data.orders)) { 
                allOrders = data.orders;
                if (currentTab === 'orders') applyFiltersAndSearch();
                const lastUpdateEl = document.getElementById('lastUpdate');
                if (lastUpdateEl) lastUpdateEl.innerHTML = `<i class="fas fa-clock"></i> ${new Date().toLocaleString()} | စုစုပေါင်း: ${allOrders.length}`;
                updateAllStats();
            } else { 
                allOrders = []; 
                if (currentTab === 'orders') applyFiltersAndSearch(); 
                updateAllStats();
            }
        } catch(e) { 
            console.error('Error loading orders:', e);
            const ordersListEl = document.getElementById('ordersList');
            if (ordersListEl) ordersListEl.innerHTML = '<div class="loading">ချိတ်ဆက်မှု အမှား</div>';
            allOrders = []; 
            updateAllStats();
        }
    }
    
    async function loadUserStats() {
        try { 
            const res = await fetchWithRetry(`${API_BASE}/api/admin/user-stats`); 
            if (!res) return;
            const data = await res.json(); 
            if (data.stats && Array.isArray(data.stats)) { 
                userStats = data.stats; 
                renderUsersTab(); 
                updateAllStats();
            } else {
                userStats = [];
                renderUsersTab();
                updateAllStats();
            }
        } catch(e) { 
            console.error('Error loading user stats:', e);
            userStats = [];
            renderUsersTab();
            updateAllStats();
        }
    }
    
    async function loadProducts() {
        try { 
            const res = await fetchWithRetry(`${API_BASE}/api/market/products`); 
            if (!res) return;
            const data = await res.json(); 
            products = data.products || []; 
            renderProducts(); 
        } catch(e) { 
            console.error('Error loading products:', e);
            renderProducts(); 
        }
    }
    
    // ============ AD MANAGEMENT FUNCTIONS ============
    async function loadAds() {
        try {
            const res = await fetchWithRetry(`${API_BASE}/api/admin/ads`);
            if (!res) return;
            const data = await res.json();
            if (data.success) {
                allAds = data.ads || [];
                renderAds();
            } else {
                allAds = [];
                renderAds();
            }
        } catch(e) {
            console.error('Error loading ads:', e);
            allAds = [];
            renderAds();
        }
    }
    
    async function loadAdSettings() {
        try {
            const res = await fetch(`${API_BASE}/api/ad-settings`);
            const data = await res.json();
            if (data.success && data.settings) {
                const modeSelect = document.getElementById('adRotationMode');
                const autoCycle = document.getElementById('adAutoCycle');
                const showNav = document.getElementById('adShowNavigation');
                if (modeSelect) modeSelect.value = data.settings.rotation_mode || 'weighted';
                if (autoCycle) autoCycle.value = data.settings.auto_cycle_seconds || 0;
                if (showNav) showNav.checked = data.settings.show_navigation !== false;
            }
        } catch(e) { console.error('Error loading ad settings:', e); }
    }
    
    window.saveAdSettings = async function() {
        const rotation_mode = document.getElementById('adRotationMode')?.value || 'weighted';
        const auto_cycle_seconds = parseInt(document.getElementById('adAutoCycle')?.value || '0');
        const show_navigation = document.getElementById('adShowNavigation')?.checked || false;
        
        try {
            const res = await fetch(`${API_BASE}/api/admin/ad-settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rotation_mode, auto_cycle_seconds, show_navigation }),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast('✅ ကြော်ငြာဆက်တင်များ သိမ်းပြီးပါပြီ');
            } else {
                showToast('❌ သိမ်းဆည်းရန် မအောင်မြင်ပါ', true);
            }
        } catch(e) {
            showToast('Error: ' + e.message, true);
        }
    };
    
    function renderAds() {
        const container = document.getElementById('adsList');
        if (!container) return;
        
        if (!allAds.length) {
            container.innerHTML = '<div class="loading">ကြော်ငြာမရှိသေးပါ။ "ကြော်ငြာအသစ်" ကိုနှိပ်၍ ဖန်တီးပါ။</div>';
            return;
        }
        
        const today = new Date().toISOString().slice(0,10);
        let html = '';
        for (const ad of allAds) {
            const isExpired = ad.expiry_date && ad.expiry_date < today;
            let statusClass = 'ad-status-active';
            let statusText = '✅ ဖွင့်ထား';
            if (!ad.active) {
                statusClass = 'ad-status-inactive';
                statusText = '❌ ပိတ်ထား';
            } else if (isExpired) {
                statusClass = 'ad-status-expired';
                statusText = '⏰ သက်တမ်းကုန်';
            }
            
            html += `
                <div class="ad-card" data-id="${ad.id}">
                    <div class="${statusClass}">${statusText}</div>
                    <img src="${escapeHtml(ad.image_url)}" onerror="this.src='https://placehold.co/728x200/333/white?text=No+Image'">
                    <div><strong>${escapeHtml(ad.name)}</strong></div>
                    <div style="font-size:0.7rem; color:#94a3b8; margin-top:4px;">🔗 ${escapeHtml(ad.destination_url.substring(0, 50))}</div>
                    ${ad.alt_text ? `<div style="font-size:0.65rem; color:#64748b; margin-top:6px;">📝 ${escapeHtml(ad.alt_text)}</div>` : ''}
                    <div style="font-size:0.65rem; color:#64748b; margin-top:8px;">
                        <i class="fas fa-weight-hanging"></i> အလေးချိန်: ${ad.display_weight || 5} | 
                        <i class="fas fa-calendar"></i> ${ad.expiry_date || 'သက်တမ်းမသတ်မှတ်ရ'} |
                        <i class="fas fa-eye"></i> ${ad.views || 0} | 
                        <i class="fas fa-mouse-pointer"></i> ${ad.clicks || 0}
                    </div>
                    <div class="ad-card-actions">
                        <button class="ad-edit-btn" onclick="editAd(${ad.id})"><i class="fas fa-edit"></i> တည်းဖြတ်</button>
                        <button class="ad-toggle-btn" onclick="toggleAd(${ad.id}, ${!ad.active})"><i class="fas ${ad.active ? 'fa-ban' : 'fa-play'}"></i> ${ad.active ? 'ပိတ်မယ်' : 'ဖွင့်မယ်'}</button>
                        <button class="ad-delete-btn" onclick="deleteAd(${ad.id})"><i class="fas fa-trash"></i> ဖျက်မယ်</button>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    }
    
    window.openAddAdModal = function() {
        editingAdId = null;
        document.getElementById('adModalTitle').innerText = 'ကြော်ငြာအသစ်ထည့်ရန်';
        document.getElementById('adName').value = '';
        document.getElementById('adImageUrl').value = '';
        document.getElementById('adDestinationUrl').value = '';
        document.getElementById('adAltText').value = '';
        document.getElementById('adDisplayWeight').value = '5';
        document.getElementById('adExpiryDate').value = '';
        document.getElementById('adModal').classList.add('active');
    };
    
    window.closeAdModal = function() {
        document.getElementById('adModal').classList.remove('active');
    };
    
    window.editAd = function(id) {
        const ad = allAds.find(a => a.id === id);
        if (!ad) return;
        editingAdId = id;
        document.getElementById('adModalTitle').innerText = 'ကြော်ငြာတည်းဖြတ်ရန်';
        document.getElementById('adName').value = ad.name;
        document.getElementById('adImageUrl').value = ad.image_url;
        document.getElementById('adDestinationUrl').value = ad.destination_url;
        document.getElementById('adAltText').value = ad.alt_text || '';
        document.getElementById('adDisplayWeight').value = ad.display_weight || 5;
        document.getElementById('adExpiryDate').value = ad.expiry_date || '';
        document.getElementById('adModal').classList.add('active');
    };
    
    window.saveAd = async function() {
        const name = document.getElementById('adName')?.value.trim();
        const image_url = document.getElementById('adImageUrl')?.value.trim();
        const destination_url = document.getElementById('adDestinationUrl')?.value.trim();
        const alt_text = document.getElementById('adAltText')?.value.trim();
        const display_weight = parseInt(document.getElementById('adDisplayWeight')?.value || '5');
        const expiry_date = document.getElementById('adExpiryDate')?.value || null;
        
        if (!name || !image_url || !destination_url) {
            showToast('ကျေးဇူးပြု၍ အမည်၊ ပုံ URL နှင့် Website Link ကို ဖြည့်ပါ', true);
            return;
        }
        
        const url = editingAdId ? `${API_BASE}/api/admin/ads/${editingAdId}` : `${API_BASE}/api/admin/ads`;
        const method = editingAdId ? 'PUT' : 'POST';
        const body = { name, image_url, destination_url, alt_text, display_weight, expiry_date };
        
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast(editingAdId ? '✅ ကြော်ငြာ တည်းဖြတ်ပြီးပါပြီ' : '✅ ကြော်ငြာအသစ် ထည့်ပြီးပါပြီ');
                closeAdModal();
                loadAds();
            } else {
                showToast('❌ သိမ်းဆည်းရန် မအောင်မြင်ပါ', true);
            }
        } catch(e) {
            showToast('Error: ' + e.message, true);
        }
    };
    
    window.toggleAd = async function(id, newActiveStatus) {
        try {
            const res = await fetch(`${API_BASE}/api/admin/ads/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: newActiveStatus }),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast(newActiveStatus ? '✅ ကြော်ငြာ ဖွင့်ပြီးပါပြီ' : '❌ ကြော်ငြာ ပိတ်ပြီးပါပြီ');
                loadAds();
            } else {
                showToast('❌ မအောင်မြင်ပါ', true);
            }
        } catch(e) {
            showToast('Error: ' + e.message, true);
        }
    };
    
    window.deleteAd = async function(id) {
        if (!confirm('ဒီကြော်ငြာကို ဖျက်မှာလား။ ပြန်လည်ရယူလို့မရပါ။')) return;
        try {
            const res = await fetch(`${API_BASE}/api/admin/ads/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast('🗑 ကြော်ငြာ ဖျက်ပြီးပါပြီ');
                loadAds();
            } else {
                showToast('❌ ဖျက်ရန် မအောင်မြင်ပါ', true);
            }
        } catch(e) {
            showToast('Error: ' + e.message, true);
        }
    };
    // ============ END AD MANAGEMENT ============
    
    function renderProducts() {
        const container = document.getElementById('productList');
        if (!container) return;
        if (!products.length) { 
            container.innerHTML = '<div class="loading">ထုတ်ကုန်မရှိပါ။ "ထုတ်ကုန်ထည့်ရန်" ကိုနှိပ်၍ ဖန်တီးပါ။</div>'; 
            return; 
        }
        let html = '';
        for (const p of products) {
            html += `<div class="product-card"><div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05);"><div style="display:flex; align-items:center; gap:12px;">${p.image ? `<img src="${escapeHtml(p.image)}" style="width:50px; height:50px; object-fit:cover; border-radius:8px; background:rgba(0,0,0,0.3);" onerror="this.style.display='none'">` : `<div style="width:50px; height:50px; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.3); border-radius:8px;"><i class="${escapeHtml(p.icon || 'fas fa-box')}"></i></div>`}<div><strong>${escapeHtml(p.name)}</strong><br><span style="font-size:0.65rem;">💰 ${p.price.toLocaleString()} MMK</span></div></div><span style="font-size:0.65rem; background:rgba(0,212,255,0.15); padding:3px 10px; border-radius:40px;">${escapeHtml(p.category || 'အမျိုးအစားမရှိ')}</span></div><div style="margin:8px 0;">${p.discount ? `<span style="background:rgba(245,158,11,0.2); color:#fbbf24; font-size:0.6rem; display:inline-block; padding:2px 8px; border-radius:40px;">-${p.discount}% လျှော့စျေး</span>` : ''}</div><div style="display:flex; gap:8px; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05);"><button onclick="window.openEditProductModal(${p.id})" style="flex:1; border:none; padding:6px; border-radius:40px; font-size:0.65rem; cursor:pointer; font-weight:600; background:rgba(0,212,255,0.2); color:var(--cyan);"><i class="fas fa-edit"></i> တည်းဖြတ်ရန်</button><button onclick="window.deleteProduct(${p.id})" style="flex:1; border:none; padding:6px; border-radius:40px; font-size:0.65rem; cursor:pointer; font-weight:600; background:rgba(244,63,94,0.2); color:#fb7185;"><i class="fas fa-trash"></i> ဖျက်ရန်</button></div></div>`;
        }
        container.innerHTML = html;
    }
    
    window.openAddProductModal = function() { 
        editingProductId = null; 
        const titleEl = document.getElementById('productModalTitle');
        const nameEl = document.getElementById('productName');
        const priceEl = document.getElementById('productPrice');
        const imageEl = document.getElementById('productImage');
        const categoryEl = document.getElementById('productCategory');
        const iconEl = document.getElementById('productIcon');
        const discountEl = document.getElementById('productDiscount');
        const modal = document.getElementById('productModal');
        if (titleEl) titleEl.innerText = 'ထုတ်ကုန်ထည့်ရန်';
        if (nameEl) nameEl.value = '';
        if (priceEl) priceEl.value = '';
        if (imageEl) imageEl.value = '';
        if (categoryEl) categoryEl.value = '';
        if (iconEl) iconEl.value = 'fas fa-box';
        if (discountEl) discountEl.value = '';
        if (modal) modal.classList.add('active');
    };
    
    window.openEditProductModal = function(id) { 
        const product = products.find(p => p.id === id); 
        if (!product) return; 
        editingProductId = id; 
        const titleEl = document.getElementById('productModalTitle');
        const nameEl = document.getElementById('productName');
        const priceEl = document.getElementById('productPrice');
        const imageEl = document.getElementById('productImage');
        const categoryEl = document.getElementById('productCategory');
        const iconEl = document.getElementById('productIcon');
        const discountEl = document.getElementById('productDiscount');
        const modal = document.getElementById('productModal');
        if (titleEl) titleEl.innerText = 'ထုတ်ကုန်တည်းဖြတ်ရန်';
        if (nameEl) nameEl.value = product.name;
        if (priceEl) priceEl.value = product.price;
        if (imageEl) imageEl.value = product.image || '';
        if (categoryEl) categoryEl.value = product.category || '';
        if (iconEl) iconEl.value = product.icon || 'fas fa-box';
        if (discountEl) discountEl.value = product.discount || '';
        if (modal) modal.classList.add('active');
    };
    
    window.closeProductModal = function() { 
        const modal = document.getElementById('productModal');
        if (modal) modal.classList.remove('active');
    };
    
    window.saveProduct = async function() { 
        const name = document.getElementById('productName')?.value.trim() || ''; 
        const price = parseInt(document.getElementById('productPrice')?.value || '0'); 
        const image = document.getElementById('productImage')?.value.trim() || ''; 
        const category = document.getElementById('productCategory')?.value.trim() || ''; 
        const icon = document.getElementById('productIcon')?.value.trim() || ''; 
        const discount = parseInt(document.getElementById('productDiscount')?.value || '0') || 0; 
        if (!name || !price) { 
            showToast("ကျေးဇူးပြု၍ ထုတ်ကုန်အမည်နှင့် စျေးနှုန်းကို ဖြည့်သွင်းပါ", true); 
            return; 
        } 
        const url = editingProductId ? `${API_BASE}/api/market/products/${editingProductId}` : `${API_BASE}/api/market/products`; 
        const method = editingProductId ? 'PUT' : 'POST'; 
        try { 
            const res = await fetchWithRetry(url, { 
                method, 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ name, price, image, category, icon, discount }) 
            }); 
            if (res && res.ok) { 
                showToast(editingProductId ? 'ထုတ်ကုန် အပ်ဒိတ်လုပ်ပြီးပါပြီ' : 'ထုတ်ကုန် ထည့်သွင်းပြီးပါပြီ'); 
                window.closeProductModal(); 
                loadProducts(); 
            } else { 
                showToast('ထုတ်ကုန်သိမ်းဆည်းရာတွင် အမှားရှိသည်', true); 
            } 
        } catch(e) { 
            showToast('ထုတ်ကုန်သိမ်းဆည်းရာတွင် အမှားရှိသည်', true); 
        } 
    };
    
    window.deleteProduct = async function(id) { 
        if (!confirm('ဤထုတ်ကုန်ကို ဖျက်မည်လား။')) return; 
        try { 
            const res = await fetchWithRetry(`${API_BASE}/api/market/products/${id}`, { method: 'DELETE' }); 
            if (res && res.ok) { 
                showToast('ထုတ်ကုန် ဖျက်ပြီးပါပြီ'); 
                loadProducts(); 
            } else { 
                showToast('ထုတ်ကုန်ဖျက်ရာတွင် အမှားရှိသည်', true); 
            } 
        } catch(e) { 
            showToast('ထုတ်ကုန်ဖျက်ရာတွင် အမှားရှိသည်', true); 
        } 
    };
    
    window.blockUser = async function(phone, block) { 
        try { 
            const res = await fetchWithRetry(`${API_BASE}/api/admin/user-block`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ phone, block }) 
            }); 
            if (res && res.ok) { 
                loadUserStats(); 
                showToast(block ? '✅ အသုံးပြုသူအား ပိတ်ဆို့ထားပါသည်' : '✅ အသုံးပြုသူအား ဖွင့်ပေးထားပါသည်'); 
            } else { 
                showToast('အမှားရှိသည်', true); 
            } 
        } catch(e) { 
            showToast('အမှားရှိသည်', true); 
        } 
    };
    
    window.clearSuspectFlag = async function(phone) { 
        try { 
            const res = await fetchWithRetry(`${API_BASE}/api/admin/clear-suspect`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ phone }) 
            }); 
            if (res && res.ok) { 
                loadUserStats(); 
                showToast('✅ သံသယအလံ ရှင်းလင်းပြီးပါပြီ'); 
            } else { 
                showToast('အမှားရှိသည်', true); 
            } 
        } catch(e) { 
            showToast('အမှားရှိသည်', true); 
        } 
    };
    
    window.deleteUser = async function(phone) { 
        if (confirm(`⚠️ အသုံးပြုသူ ${maskPhone(phone)} ကို ဖျက်မည်မှာ သေချာပါသလား။`)) { 
            try { 
                const res = await fetchWithRetry(`${API_BASE}/api/admin/user-delete`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ phone }) 
                }); 
                if (res && res.ok) { 
                    loadUserStats(); 
                    showToast('✅ အသုံးပြုသူအား စာရင်းမှ ဖျက်ပြီးပါပြီ'); 
                } else { 
                    showToast('အမှားရှိသည်', true); 
                } 
            } catch(e) { 
                showToast('အမှားရှိသည်', true); 
            } 
        } 
    };
    
    window.deleteAllOrders = async function(phone) { 
        if (confirm(`⚠️ ${maskPhone(phone)} အတွက် အမိန့်စာအားလုံးကို ဖျက်မည်လား။`)) { 
            try { 
                const res = await fetchWithRetry(`${API_BASE}/api/admin/user-delete-orders`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ phone }) 
                }); 
                if (res && res.ok) { 
                    loadAllData(); 
                    showToast('✅ အမိန့်စာအားလုံး ဖျက်ပြီးပါပြီ'); 
                } else { 
                    showToast('အမှားရှိသည်', true); 
                } 
            } catch(e) { 
                showToast('အမှားရှိသည်', true); 
            } 
        } 
    };
    
    window.exportUsersToCSV = function() { 
        if (!userStats.length) { 
            showToast('တင်ပို့ရန် အသုံးပြုသူမရှိပါ', true); 
            return; 
        } 
        let csv = "အသုံးပြုသူ ID,ဖုန်းနံပါတ်,အသုံးပြုသူအမည်,အမိန့်စာအရေအတွက်,ပယ်ချခံရအရေအတွက်,ပယ်ချမှုနှုန်း,သံသယရှိ,ပိတ်ဆို့ထား,စာရင်းသွင်းရက်\n"; 
        userStats.forEach(u => { 
            const rejectRate = u.order_count > 0 ? ((u.reject_count / u.order_count) * 100).toFixed(1) : 0; 
            csv += `"${u.user_id || 'N/A'}","${u.phone}","${u.username || ''}",${u.order_count},${u.reject_count},${rejectRate}%,${u.suspect_flag ? 'ဟုတ်ကဲ့' : 'မဟုတ်ပါ'},${u.blocked ? 'ဟုတ်ကဲ့' : 'မဟုတ်ပါ'},"${new Date(u.created_at).toLocaleDateString()}"\n`; 
        }); 
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); 
        const link = document.createElement('a'); 
        const url = URL.createObjectURL(blob); 
        link.href = url; 
        link.setAttribute('download', `users_${new Date().toISOString().slice(0,19)}.csv`); 
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link); 
        URL.revokeObjectURL(url); 
        showToast('📁 အသုံးပြုသူများအား CSV သို့ တင်ပို့ပြီးပါပြီ'); 
    };
    
    window.exportOrdersToCSV = function() { 
        if (!allOrders.length) { 
            showToast('တင်ပို့ရန် အမိန့်စာမရှိပါ', true); 
            return; 
        } 
        let csv = "အမိန့်စာ ID,ဖုန်းနံပါတ်,အစီအစဉ်,စျေးနှုန်း,အခြေအနေ,ငွေပေးချေမှုနည်းလမ်း,ပေးပို့သူအမည်,နောက်ဆုံးဂဏန်း ၅လုံး,အမိန့်စာရက်စွဲ,အသက်သွင်းရက်စွဲ\n"; 
        allOrders.forEach(o => { 
            csv += `"${o.id}","${o.phone}","${o.plan}",${o.price},"${o.status}","${o.payment_method || 'kpay'}","${o.sender_name || ''}","${o.last5_digits || ''}","${new Date(o.created_at).toLocaleString()}","${o.activated_at ? new Date(o.activated_at).toLocaleString() : ''}"\n`; 
        }); 
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); 
        const link = document.createElement('a'); 
        const url = URL.createObjectURL(blob); 
        link.href = url; 
        link.setAttribute('download', `orders_${new Date().toISOString().slice(0,19)}.csv`); 
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link); 
        URL.revokeObjectURL(url); 
        showToast('📁 အမိန့်စာများအား CSV သို့ တင်ပို့ပြီးပါပြီ'); 
    };
    
    function renderUsersTab() {
        const container = document.getElementById('usersList');
        if (!container) return;
        if (!userStats.length) { 
            container.innerHTML = '<div class="loading">အသုံးပြုသူဒေတာ မရှိပါ</div>'; 
            return; 
        }
        let filteredUsers = [...userStats];
        if (currentUserSearchPhone) { 
            filteredUsers = filteredUsers.filter(u => u.phone === currentUserSearchPhone || u.user_id === currentUserSearchPhone || (u.username && u.username.toLowerCase().includes(currentUserSearchPhone.toLowerCase()))); 
        }
        if (filteredUsers.length === 0 && currentUserSearchPhone) { 
            container.innerHTML = `<div class="loading">"${escapeHtml(currentUserSearchPhone)}" အတွက် အသုံးပြုသူ မတွေ့ပါ</div>`; 
            return; 
        }
        let html = '';
        for (const user of filteredUsers) {
            const rejectRate = user.order_count > 0 ? ((user.reject_count / user.order_count) * 100).toFixed(0) : 0;
            let statusClass = 'normal'; 
            let statusText = '🟢 ပုံမှန်';
            if (user.blocked) { 
                statusClass = 'blocked'; 
                statusText = '🔴 ပိတ်ဆို့ထား'; 
            } else if (user.suspect_flag) { 
                statusClass = 'suspect'; 
                statusText = '🟡 သံသယရှိ'; 
            }
            html += `<div class="user-card"><div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05);"><div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;"><span style="font-family:monospace; font-size:0.8rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;" onclick="window.copyToClipboard('${escapeHtml(user.phone)}')">📞 ${escapeHtml(maskPhone(user.phone))} 📋</span><span style="font-family:monospace; font-size:0.7rem; background:rgba(0,212,255,0.1); padding:3px 10px; border-radius:40px; color:var(--cyan); display:inline-flex; align-items:center; gap:6px;" onclick="window.copyToClipboard('${escapeHtml(user.user_id || '')}')">🆔 ${escapeHtml(user.user_id || 'N/A')} 📋</span></div><span style="font-size:0.6rem; padding:3px 8px; border-radius:40px; background:${statusClass === 'blocked' ? 'rgba(244,63,94,0.2)' : (statusClass === 'suspect' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)')}; color:${statusClass === 'blocked' ? '#fb7185' : (statusClass === 'suspect' ? '#fbbf24' : '#34d399')};">${escapeHtml(statusText)}</span></div><div style="display:flex; justify-content:space-around; margin-bottom:10px;"><div style="text-align:center;"><div style="font-size:1.1rem; font-weight:700;">${user.order_count || 0}</div><div style="font-size:0.55rem; color:#64748b;">အမိန့်စာများ</div></div><div style="text-align:center;"><div style="font-size:1.1rem; font-weight:700;">${user.reject_count || 0}</div><div style="font-size:0.55rem; color:#64748b;">ပယ်ချခံရ</div></div><div style="text-align:center;"><div style="font-size:1.1rem; font-weight:700;">${rejectRate}%</div><div style="font-size:0.55rem; color:#64748b;">ပယ်ချမှုနှုန်း</div></div></div><div style="display:flex; gap:8px; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05); flex-wrap:wrap;">${!user.blocked ? `<button onclick="window.blockUser('${escapeHtml(user.phone)}', true)" style="flex:1; border:none; padding:8px 12px; border-radius:40px; font-size:0.7rem; cursor:pointer; font-weight:600; background:rgba(244,63,94,0.2); color:#fb7185;">🔴 ပိတ်ဆို့ရန်</button>` : `<button onclick="window.blockUser('${escapeHtml(user.phone)}', false)" style="flex:1; border:none; padding:8px 12px; border-radius:40px; font-size:0.7rem; cursor:pointer; font-weight:600; background:rgba(16,185,129,0.2); color:#34d399;">🟢 ဖွင့်ပေးရန်</button>`}<button onclick="window.deleteUser('${escapeHtml(user.phone)}')" style="flex:1; border:none; padding:8px 12px; border-radius:40px; font-size:0.7rem; cursor:pointer; font-weight:600; background:rgba(244,63,94,0.2); color:#fb7185;">❌ အသုံးပြုသူဖျက်ရန်</button><button onclick="window.deleteAllOrders('${escapeHtml(user.phone)}')" style="flex:1; border:none; padding:8px 12px; border-radius:40px; font-size:0.7rem; cursor:pointer; font-weight:600; background:rgba(245,158,11,0.2); color:#fbbf24;">🗑 အမိန့်စာအားလုံးဖျက်ရန်</button>${user.suspect_flag ? `<button onclick="window.clearSuspectFlag('${escapeHtml(user.phone)}')" style="flex:1; border:none; padding:8px 12px; border-radius:40px; font-size:0.7rem; cursor:pointer; font-weight:600; background:rgba(0,212,255,0.15); color:var(--cyan);">✓ အလံရှင်းလင်းရန်</button>` : ''}</div></div>`;
        }
        container.innerHTML = html;
    }
    
    function applyFiltersAndSearch() {
        let filtered = [...allOrders];
        if (currentSearchPhone) filtered = filtered.filter(o => o.phone === currentSearchPhone);
        const status = document.getElementById('statusFilter')?.value;
        if (status && status !== 'all') filtered = filtered.filter(o => o.status === status);
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        if (startDate) { 
            const start = new Date(startDate); 
            start.setHours(0,0,0,0); 
            filtered = filtered.filter(o => new Date(o.created_at) >= start); 
        }
        if (endDate) { 
            const end = new Date(endDate); 
            end.setHours(23,59,59,999); 
            filtered = filtered.filter(o => new Date(o.created_at) <= end); 
        }
        renderOrders(filtered);
        updateAllStats();
    }
    
    window.searchByPhoneOrId = function() { 
        const searchValue = document.getElementById('searchInput')?.value.trim(); 
        if (!searchValue) return; 
        currentSearchPhone = searchValue; 
        applyFiltersAndSearch(); 
    };
    
    window.clearSearch = function() { 
        currentSearchPhone = ""; 
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = "";
        applyFiltersAndSearch(); 
        showToast('🔍 ရှာဖွေမှု ရှင်းလင်းပြီးပါပြီ'); 
    };
    
    window.searchUsers = function() { 
        const searchValue = document.getElementById('userSearchInput')?.value.trim(); 
        if (!searchValue) return; 
        currentUserSearchPhone = searchValue; 
        renderUsersTab(); 
    };
    
    window.clearUserSearch = function() { 
        currentUserSearchPhone = ""; 
        const userSearchInput = document.getElementById('userSearchInput');
        if (userSearchInput) userSearchInput.value = "";
        renderUsersTab(); 
        showToast('🔍 ရှာဖွေမှု ရှင်းလင်းပြီးပါပြီ'); 
    };
    
    window.applyFilters = function() { applyFiltersAndSearch(); };
    
    window.clearFilters = function() { 
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        const statusFilter = document.getElementById('statusFilter');
        if (startDate) startDate.value = '';
        if (endDate) endDate.value = '';
        if (statusFilter) statusFilter.value = 'all';
        applyFiltersAndSearch(); 
        showToast('✅ စစ်ထုတ်မှုများ ရှင်းလင်းပြီးပါပြီ'); 
    };
    
    function renderOrders(orders) {
        const container = document.getElementById('ordersList');
        if (!container) return;
        if (!orders || orders.length === 0) { 
            container.innerHTML = '<div class="loading">အမိန့်စာ မတွေ့ပါ</div>'; 
            return; 
        }
        let html = '';
        for (const o of orders) {
            let statusText = o.status === 'Pending' ? '⏳ ဆိုင်းငံ့ထားသော' : (o.status === 'Approved' ? '✅ အတည်ပြုပြီး' : '❌ ပယ်ချထားသော');
            let countdownHtml = '';
            if (o.status === 'Approved' && o.activated_at) {
                const initialCountdown = formatCountdown(o.activated_at);
                countdownHtml = `<div class="countdown-box" id="countdown-${o.id}" style="background:rgba(0,212,255,0.08); border-radius:40px; padding:6px 12px; margin-top:8px; display:flex; align-items:center; justify-content:center; gap:8px; font-size:0.7rem; font-family:monospace; border:1px solid rgba(0,212,255,0.2);"><i class="fas fa-hourglass-half"></i><span class="countdown-timer" style="font-weight:700; color:var(--cyan); letter-spacing:1px;">${initialCountdown || 'တွက်နေသည်...'}</span></div>`;
            }
            let proofHtml = '';
            if (o.sender_name && o.last5_digits) { 
                proofHtml = `<div style="display:flex; justify-content:center; align-items:center; gap:24px; flex-wrap:wrap; background:rgba(0,212,255,0.05); border-radius:40px; padding:8px 16px; margin:8px 0; border:1px solid rgba(0,212,255,0.1);"><div style="display:flex; align-items:center; gap:8px; font-size:0.7rem;"><span style="color:var(--text-secondary); font-weight:500;"><i class="fas fa-user-circle"></i> ပေးပို့သူ:</span><span style="font-weight:600; color:var(--emerald);">${escapeHtml(o.sender_name)}</span></div><div style="display:flex; align-items:center; gap:8px; font-size:0.7rem;"><span style="color:var(--text-secondary); font-weight:500;"><i class="fas fa-receipt"></i> နောက်ဆုံး ၅လုံး:</span><span style="font-weight:600; color:var(--amber); font-family:monospace; letter-spacing:1px;">${escapeHtml(o.last5_digits)}</span></div><div style="display:flex; align-items:center; gap:8px; font-size:0.7rem;"><span style="color:var(--text-secondary); font-weight:500;"><i class="fas fa-credit-card"></i> ငွေပေးချေမှု:</span><span style="font-weight:600; color:var(--violet);">${getPaymentIcon(o.payment_method || 'kpay')}</span></div></div>`; 
            } else if (o.payment_method) { 
                proofHtml = `<div style="display:flex; justify-content:center; align-items:center; gap:24px; flex-wrap:wrap; background:rgba(0,212,255,0.05); border-radius:40px; padding:8px 16px; margin:8px 0; border:1px solid rgba(0,212,255,0.1);"><div style="display:flex; align-items:center; gap:8px; font-size:0.7rem;"><span style="color:var(--text-secondary); font-weight:500;"><i class="fas fa-credit-card"></i> ငွေပေးချေမှု:</span><span style="font-weight:600; color:var(--violet);">${getPaymentIcon(o.payment_method)}</span></div></div>`; 
            }
            html += `<div class="order-card"><div class="order-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05);"><span class="order-id" style="font-family:monospace; font-size:0.7rem; background:rgba(0,212,255,0.1); padding:3px 8px; border-radius:20px; color:var(--cyan);"><i class="fas fa-hashtag"></i> ${o.id}</span><span class="status-badge" style="display:inline-block; padding:4px 10px; border-radius:40px; font-size:0.6rem; font-weight:700; background:${o.status === 'Pending' ? 'rgba(245,158,11,0.2)' : (o.status === 'Approved' ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)')}; color:${o.status === 'Pending' ? '#fbbf24' : (o.status === 'Approved' ? '#34d399' : '#fb7185')};">${statusText}</span></div><div class="order-details" style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:10px;"><div class="detail-item" style="flex:1; min-width:80px;"><div class="detail-label" style="font-size:0.55rem; color:#64748b; margin-bottom:2px;"><i class="fas fa-mobile-alt"></i> ဖုန်းနံပါတ်</div><div class="detail-value clickable-phone" style="font-size:0.8rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;" onclick="window.copyToClipboard('${escapeHtml(o.phone)}')">📞 ${escapeHtml(maskPhone(o.phone))} 📋</div></div><div class="detail-item" style="flex:1; min-width:80px;"><div class="detail-label" style="font-size:0.55rem; color:#64748b; margin-bottom:2px;"><i class="fas fa-tag"></i> အစီအစဉ်</div><div class="detail-value" style="font-size:0.8rem; font-weight:600; font-size:0.7rem;">${escapeHtml(o.plan)}</div></div><div class="detail-item" style="flex:1; min-width:80px;"><div class="detail-label" style="font-size:0.55rem; color:#64748b; margin-bottom:2px;"><i class="fas fa-coins"></i> စျေးနှုန်း</div><div class="detail-value price" style="font-size:0.8rem; font-weight:600; color:var(--emerald);">${o.price.toLocaleString()}K</div></div><div class="detail-item" style="flex:1; min-width:80px;"><div class="detail-label" style="font-size:0.55rem; color:#64748b; margin-bottom:2px;"><i class="fas fa-box"></i> ကုန်ကျစရိတ်</div><div class="detail-value cost" style="font-size:0.8rem; font-weight:600; color:var(--amber);">${getCostPrice(o.plan).toLocaleString()}K</div></div><div class="detail-item" style="flex:1; min-width:80px;"><div class="detail-label" style="font-size:0.55rem; color:#64748b; margin-bottom:2px;"><i class="fas fa-chart-line"></i> အမြတ်</div><div class="detail-value profit" style="font-size:0.8rem; font-weight:600; color:var(--cyan);">${getProfit(o.price, o.plan).toLocaleString()}K</div></div><div class="detail-item" style="flex:1; min-width:80px;"><div class="detail-label" style="font-size:0.55rem; color:#64748b; margin-bottom:2px;"><i class="fas fa-calendar"></i> ရက်စွဲ</div><div class="detail-value" style="font-size:0.8rem; font-weight:600; font-size:0.65rem;">${new Date(o.created_at).toLocaleString()}</div></div></div>${proofHtml}${countdownHtml}<div class="order-actions" style="display:flex; gap:8px; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05); flex-wrap:wrap;">${o.slip_url ? `<button class="screenshot-btn" onclick="window.openScreenshot('${escapeHtml(o.slip_url)}')" style="background:rgba(0,212,255,0.15); border:1px solid rgba(0,212,255,0.3); padding:6px 12px; border-radius:40px; font-size:0.7rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px; color:var(--cyan);"><i class="fas fa-image"></i> ဖန်သားပြင်ဓာတ်ပုံကြည့်ရန်</button>` : '<span style="font-size:0.6rem;color:#64748b;">ဖန်သားပြင်ဓာတ်ပုံမရှိ</span>'}${o.status === 'Pending' ? `<button class="action-btn approve" onclick="window.approveOrder(${o.id})" style="flex:1; border:none; padding:8px 12px; border-radius:40px; font-size:0.7rem; cursor:pointer; font-weight:600; display:flex; align-items:center; justify-content:center; gap:6px; background:#10b981; color:white;"><i class="fas fa-check"></i> အတည်ပြုရန်</button><button class="action-btn reject" onclick="window.rejectOrder(${o.id})" style="flex:1; border:none; padding:8px 12px; border-radius:40px; font-size:0.7rem; cursor:pointer; font-weight:600; display:flex; align-items:center; justify-content:center; gap:6px; background:#f43f5e; color:white;"><i class="fas fa-times"></i> ပယ်ချရန်</button>` : ''}<button class="action-btn delete" onclick="window.deleteOrder(${o.id})" style="flex:1; border:none; padding:8px 12px; border-radius:40px; font-size:0.7rem; cursor:pointer; font-weight:600; display:flex; align-items:center; justify-content:center; gap:6px; background:#475569; color:white;"><i class="fas fa-trash"></i> ဖျက်ရန်</button></div></div>`;
        }
        container.innerHTML = html;
        for (const o of orders) { 
            if (o.status === 'Approved' && o.activated_at) { 
                startCountdownForOrder(o.id, o.activated_at); 
            } 
        }
    }
    
    window.approveOrder = async function(id) { 
        try { 
            const res = await fetchWithRetry(`${API_BASE}/api/admin/orders/${id}/approve`, { method: 'PUT' }); 
            if (res && res.ok) { 
                showToast('✅ အတည်ပြုပြီးပါပြီ'); 
                loadOrders(); 
            } else { 
                showToast('အမှားရှိသည်', true); 
            } 
        } catch(e) { 
            showToast('အမှားရှိသည်', true); 
        } 
    };
    
    window.rejectOrder = async function(id) { 
        try { 
            const res = await fetchWithRetry(`${API_BASE}/api/admin/orders/${id}/reject`, { method: 'PUT' }); 
            if (res && res.ok) { 
                showToast('❌ ပယ်ချပြီးပါပြီ'); 
                loadOrders(); 
                loadUserStats(); 
            } else { 
                showToast('အမှားရှိသည်', true); 
            } 
        } catch(e) { 
            showToast('အမှားရှိသည်', true); 
        } 
    };
    
    window.deleteOrder = async function(id) { 
        if (confirm('ဤအမိန့်စာကို ဖျက်မည်လား။')) { 
            try { 
                const res = await fetchWithRetry(`${API_BASE}/api/admin/orders/${id}`, { method: 'DELETE' }); 
                if (res && res.ok) { 
                    showToast('🗑 ဖျက်ပြီးပါပြီ'); 
                    loadOrders(); 
                } else { 
                    showToast('အမှားရှိသည်', true); 
                } 
            } catch(e) { 
                showToast('အမှားရှိသည်', true); 
            } 
        } 
    };
    
    window.manualRefresh = function() { 
        loadAllData(); 
        loadSalesHours();
        loadAdSettings();
        showToast('🔄 ဒေတာ စင့်ခ်လုပ်ပြီးပါပြီ'); 
    };
    
    window.toggleDrawer = function() { 
        const drawer = document.getElementById('drawer');
        const overlay = document.getElementById('drawerOverlay');
        if (drawer) drawer.classList.toggle('open');
        if (overlay) overlay.classList.toggle('open');
    };
    
    window.closeDrawer = function() { 
        const drawer = document.getElementById('drawer');
        const overlay = document.getElementById('drawerOverlay');
        if (drawer) drawer.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    };
    
    window.switchTab = function(tab) {
        currentTab = tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        const tabElement = document.getElementById(`${tab}Tab`);
        if (tabElement) tabElement.classList.add('active');
        document.querySelectorAll('.nav-item').forEach(item => { 
            if (item.dataset.tab === tab) item.classList.add('active'); 
            else item.classList.remove('active'); 
        });
        if (tab === 'orders') applyFiltersAndSearch();
        else if (tab === 'users') renderUsersTab();
        else if (tab === 'market') loadProducts();
        else if (tab === 'ads') loadAds();
    };
    
    document.querySelectorAll('.nav-item').forEach(btn => { 
        btn.addEventListener('click', () => { 
            if (btn.dataset.tab === 'chat') {
                openAdminChatWidget();
            } else {
                window.switchTab(btn.dataset.tab);
            }
        }); 
    });
    
    // ============ SALES HOURS CONTROL ============
    async function loadSalesHours() {
        try {
            const response = await fetch(`${API_BASE}/api/admin/sales-hours`, { credentials: 'include' });
            const data = await response.json();
            if (data.success) {
                const mode = data.salesHours.mode || 'auto';
                
                const autoBtn = document.getElementById('autoModeBtn');
                const manualBtn = document.getElementById('manualModeBtn');
                if (mode === 'auto') {
                    autoBtn.style.background = 'linear-gradient(135deg, var(--cyan), #0891b2)';
                    autoBtn.style.color = 'white';
                    autoBtn.style.border = 'none';
                    manualBtn.style.background = 'rgba(0,212,255,0.2)';
                    manualBtn.style.color = 'var(--cyan)';
                    manualBtn.style.border = '1px solid rgba(0,212,255,0.3)';
                } else {
                    manualBtn.style.background = 'linear-gradient(135deg, var(--cyan), #0891b2)';
                    manualBtn.style.color = 'white';
                    manualBtn.style.border = 'none';
                    autoBtn.style.background = 'rgba(0,212,255,0.2)';
                    autoBtn.style.color = 'var(--cyan)';
                    autoBtn.style.border = '1px solid rgba(0,212,255,0.3)';
                }
                
                document.getElementById('autoModeControls').style.display = mode === 'auto' ? 'flex' : 'none';
                document.getElementById('manualModeControls').style.display = mode === 'manual' ? 'block' : 'none';
                
                document.getElementById('salesEnabled').checked = data.salesHours.enabled;
                document.getElementById('startHour').value = data.salesHours.startHour;
                document.getElementById('endHour').value = data.salesHours.endHour;
                document.getElementById('manualToggle').checked = data.salesHours.manualStatus !== false;
                updateManualStatusText(data.salesHours.manualStatus !== false);
            }
            updateSalesStatusDisplay();
        } catch(e) { console.error('Error loading sales hours:', e); }
    }
    
    function updateManualStatusText(isOpen) {
        const textSpan = document.getElementById('manualStatusText');
        if (textSpan) {
            if (isOpen) {
                textSpan.innerHTML = '<span style="color:#34d399;">🟢 ဖွင့်ထား</span>';
            } else {
                textSpan.innerHTML = '<span style="color:#fb7185;">🔴 ပိတ်ထား</span>';
            }
        }
    }
    
    function setMode(mode) {
        const autoBtn = document.getElementById('autoModeBtn');
        const manualBtn = document.getElementById('manualModeBtn');
        if (mode === 'auto') {
            autoBtn.style.background = 'linear-gradient(135deg, var(--cyan), #0891b2)';
            autoBtn.style.color = 'white';
            autoBtn.style.border = 'none';
            manualBtn.style.background = 'rgba(0,212,255,0.2)';
            manualBtn.style.color = 'var(--cyan)';
            manualBtn.style.border = '1px solid rgba(0,212,255,0.3)';
            document.getElementById('autoModeControls').style.display = 'flex';
            document.getElementById('manualModeControls').style.display = 'none';
        } else {
            manualBtn.style.background = 'linear-gradient(135deg, var(--cyan), #0891b2)';
            manualBtn.style.color = 'white';
            manualBtn.style.border = 'none';
            autoBtn.style.background = 'rgba(0,212,255,0.2)';
            autoBtn.style.color = 'var(--cyan)';
            autoBtn.style.border = '1px solid rgba(0,212,255,0.3)';
            document.getElementById('autoModeControls').style.display = 'none';
            document.getElementById('manualModeControls').style.display = 'block';
        }
        updateSalesHoursWithMode(mode);
    }
    
    async function toggleManualShop() {
        const isOpen = document.getElementById('manualToggle').checked;
        updateManualStatusText(isOpen);
        await updateSalesHoursWithMode('manual');
    }
    
    async function updateSalesHours() {
        const currentMode = document.getElementById('autoModeControls').style.display === 'flex' ? 'auto' : 'manual';
        await updateSalesHoursWithMode(currentMode);
    }
    
    async function updateSalesHoursWithMode(mode) {
        const enabled = document.getElementById('salesEnabled').checked;
        const startHour = parseInt(document.getElementById('startHour').value);
        const endHour = parseInt(document.getElementById('endHour').value);
        const manualStatus = document.getElementById('manualToggle')?.checked || false;
        
        try {
            const response = await fetch(`${API_BASE}/api/admin/sales-hours`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled, startHour, endHour, mode, manualStatus }),
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                showToast('✅ ရောင်းချချိန် သတ်မှတ်ချက်ကို ပြင်ဆင်ပြီးပါပြီ။');
                updateSalesStatusDisplay();
            } else {
                showToast('❌ သတ်မှတ်ချက် မအောင်မြင်ပါ။', true);
            }
        } catch(e) {
            showToast('Connection error', true);
        }
    }
    
    async function updateSalesStatusDisplay() {
        try {
            const response = await fetch(`${API_BASE}/api/sales/status`);
            const data = await response.json();
            const statusDiv = document.getElementById('salesStatus');
            if (statusDiv) {
                statusDiv.innerHTML = data.message;
                statusDiv.className = `sales-status ${data.isOpen ? 'open' : 'closed'}`;
            }
        } catch(e) { console.error('Error fetching sales status:', e); }
    }
    
    // ============ ADMIN CHAT WIDGET ============
    let adminChatWidgetOpen = false;
    
    window.openAdminChatWidget = function() {
        if (adminChatWidgetOpen) return;
        
        const chatIframe = document.createElement('iframe');
        chatIframe.src = '/admin-chat.html';
        chatIframe.style.position = 'fixed';
        chatIframe.style.bottom = '70px';
        chatIframe.style.right = '16px';
        chatIframe.style.width = '380px';
        chatIframe.style.height = '520px';
        chatIframe.style.border = 'none';
        chatIframe.style.borderRadius = '1.2rem';
        chatIframe.style.zIndex = '999';
        chatIframe.style.background = 'transparent';
        chatIframe.id = 'adminChatIframe';
        document.body.appendChild(chatIframe);
        adminChatWidgetOpen = true;
    };
    
    window.closeAdminChatWidget = function() {
        const iframe = document.getElementById('adminChatIframe');
        if (iframe) {
            iframe.remove();
            adminChatWidgetOpen = false;
        }
    };
    
    window.setMode = setMode;
    window.toggleManualShop = toggleManualShop;
    window.updateSalesHours = updateSalesHours;
    window.loadSalesHours = loadSalesHours;
    window.updateSalesStatusDisplay = updateSalesStatusDisplay;
    
    const screenshotModal = document.getElementById('screenshotModal');
    if (screenshotModal) {
        screenshotModal.addEventListener('click', function(e) { 
            if (e.target === this) window.closeModal(); 
        });
    }
    
    document.addEventListener('keydown', function(e) { 
        if (e.key === 'Escape') window.closeModal(); 
    });
    
    const searchInputField = document.getElementById('searchInput');
    if (searchInputField) {
        searchInputField.addEventListener('keypress', function(e) { 
            if (e.key === 'Enter') window.searchByPhoneOrId(); 
        });
    }
    
    const userSearchInputField = document.getElementById('userSearchInput');
    if (userSearchInputField) {
        userSearchInputField.addEventListener('keypress', function(e) { 
            if (e.key === 'Enter') window.searchUsers(); 
        });
    }
    
    if (token === 'logged_in') { 
        const loginBox = document.getElementById('loginBox');
        const adminContent = document.getElementById('adminContent');
        const bottomNav = document.getElementById('bottomNav');
        if (loginBox) loginBox.style.display = 'none';
        if (adminContent) adminContent.style.display = 'block';
        if (bottomNav) bottomNav.style.display = 'flex';
        loadAllData(); 
        loadSalesHours();
        loadAdSettings();
        startAutoSync(); 
        setInterval(updateSalesStatusDisplay, 60000);
    }
})();

// ============ NOTIFICATION MANAGER (Original) ============
(function() {
    class NotificationManager {
        constructor(apiBase) {
            this.API_BASE = apiBase;
            this.notifications = [];
            this.unreadCount = 0;
            this.autoRefreshInterval = null;
        }

        async loadNotifications() {
            try {
                const res = await fetch(`${this.API_BASE}/api/admin/notifications`, {
                    credentials: 'include'
                });
                if (res.status === 401) return;
                if (!res.ok) throw new Error('Failed to load');
                const data = await res.json();
                if (data.success && data.notifications) {
                    this.notifications = data.notifications;
                    this.updateUnreadCount();
                    this.render();
                }
            } catch(e) {
                console.error('Error loading notifications:', e);
            }
        }

        updateUnreadCount() {
            this.unreadCount = this.notifications.filter(n => !n.is_read).length;
            const badge = document.getElementById('notificationBadge');
            if (badge) {
                if (this.unreadCount > 0) {
                    badge.style.display = 'flex';
                    badge.innerText = this.unreadCount > 99 ? '99+' : this.unreadCount;
                } else {
                    badge.style.display = 'none';
                }
            }
        }

        render() {
            const container = document.getElementById('notificationList');
            if (!container) return;
            
            if (this.notifications.length === 0) {
                container.innerHTML = '<div class="notification-empty">📭 အကြောင်းကြားချက်မရှိပါ</div>';
                return;
            }
            
            let html = '';
            for (const n of this.notifications) {
                const date = new Date(n.created_at);
                html += `
                    <div class="notification-item ${!n.is_read ? 'unread' : ''}">
                        <div class="notification-icon"><i class="fas fa-shopping-cart"></i></div>
                        <div class="notification-content">
                            <div class="notification-title">${this.escapeHtml(n.title)}</div>
                            <div class="notification-message">${this.escapeHtml(n.message)}</div>
                            <div class="notification-time"><i class="fas fa-clock"></i> ${date.toLocaleString()}</div>
                        </div>
                        <button class="notification-delete" data-id="${n.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            }
            container.innerHTML = html;
            
            document.querySelectorAll('.notification-delete').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const id = btn.getAttribute('data-id');
                    if (id) this.deleteNotification(parseInt(id));
                };
            });
        }

        async clearAll() {
            try {
                const res = await fetch(`${this.API_BASE}/api/admin/notifications/clear`, {
                    method: 'POST',
                    credentials: 'include'
                });
                const data = await res.json();
                if (data.success) {
                    this.notifications = [];
                    this.updateUnreadCount();
                    this.render();
                    this.showToast('✅ အကြောင်းကြားချက်များအားလုံး ရှင်းလင်းပြီးပါပြီ');
                    const dropdown = document.getElementById('notificationDropdown');
                    if (dropdown) dropdown.classList.remove('show');
                    const overlay = document.getElementById('notificationOverlay');
                    if (overlay) overlay.classList.remove('show');
                } else {
                    this.showToast('❌ အကြောင်းကြားချက်များ ရှင်းလင်းရန် မအောင်မြင်ပါ', true);
                }
            } catch(e) {
                console.error('Error clearing:', e);
            }
        }

        async deleteNotification(id) {
            try {
                const res = await fetch(`${this.API_BASE}/api/admin/notifications/${id}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const data = await res.json();
                if (data.success) {
                    this.notifications = this.notifications.filter(n => n.id !== id);
                    this.updateUnreadCount();
                    this.render();
                    this.showToast('အကြောင်းကြားချက် ဖျက်ပြီးပါပြီ');
                }
            } catch(e) {
                console.error('Error deleting:', e);
            }
        }

        showToast(msg, isError = false) {
            const toast = document.getElementById('toast');
            if (toast) {
                toast.textContent = msg;
                toast.style.background = isError ? '#f43f5e' : '#10b981';
                toast.style.display = 'block';
                setTimeout(() => { toast.style.display = 'none'; }, 2500);
            }
        }

        escapeHtml(str) {
            if (!str) return '';
            return str.replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }

        async init() {
            if (localStorage.getItem('adminToken') === 'logged_in') {
                await this.loadNotifications();
                this.autoRefreshInterval = setInterval(() => {
                    if (localStorage.getItem('adminToken') === 'logged_in') {
                        this.loadNotifications();
                    }
                }, 15000);
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('notificationBellBtn')) {
            window.notificationManager = new NotificationManager(window.location.origin);
            window.notificationManager.init();
            
            const bellBtn = document.getElementById('notificationBellBtn');
            if (bellBtn) {
                bellBtn.onclick = (e) => {
                    e.stopPropagation();
                    const dropdown = document.getElementById('notificationDropdown');
                    const overlay = document.getElementById('notificationOverlay');
                    if (dropdown) {
                        if (dropdown.classList.contains('show')) {
                            dropdown.classList.remove('show');
                            if (overlay) overlay.classList.remove('show');
                        } else {
                            dropdown.classList.add('show');
                            if (overlay) overlay.classList.add('show');
                            window.notificationManager.loadNotifications();
                        }
                    }
                };
            }
            
            const clearBtn = document.getElementById('clearNotificationsBtn');
            if (clearBtn) {
                clearBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (window.notificationManager) {
                        window.notificationManager.clearAll();
                    }
                };
            }
            
            document.addEventListener('click', (e) => {
                const dropdown = document.getElementById('notificationDropdown');
                const bell = document.getElementById('notificationBellBtn');
                if (dropdown && dropdown.classList.contains('show')) {
                    if (!dropdown.contains(e.target) && !bell?.contains(e.target)) {
                        dropdown.classList.remove('show');
                        const overlay = document.getElementById('notificationOverlay');
                        if (overlay) overlay.classList.remove('show');
                    }
                }
            });
        }
    });
})();
</script>

</body>
</html>
