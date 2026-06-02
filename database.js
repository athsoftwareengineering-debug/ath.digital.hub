// database.js - Supabase Client
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Session store for OTP
const otpStore = new Map();

// Function to save OTP
function saveOTP(phone, otp) {
    otpStore.set(phone, {
        code: otp,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    });
    // Auto cleanup after 5 mins
    setTimeout(() => {
        if (otpStore.get(phone)?.expiresAt < Date.now()) {
            otpStore.delete(phone);
        }
    }, 5 * 60 * 1000);
}

// Function to verify OTP
function verifyOTP(phone, code) {
    const record = otpStore.get(phone);
    if (!record) return false;
    if (record.expiresAt < Date.now()) {
        otpStore.delete(phone);
        return false;
    }
    if (record.code === code) {
        otpStore.delete(phone);
        return true;
    }
    return false;
}

// Function to get user data (balance from local DB)
async function getUserBalance(phone) {
    try {
        // Get user's orders
        const { data: orders } = await supabase
            .from('orders')
            .select('*')
            .eq('phone', phone)
            .eq('status', 'Approved');
        
        // Calculate total data, minutes from approved orders
        let totalDataMB = 0;
        let totalMinutes = 0;
        
        const planMapping = {
            "VIP LEVEL - 1": { data: 22 * 1024, minutes: 8000 },      // 22GB to MB, 8000 mins
            "VIP LEVEL - 2": { data: 40 * 1024, minutes: 250 },
            "VIP LEVEL - 3": { data: 40 * 1024, minutes: 1400 },
            "VIP LEVEL - 4 (ULTRA)": { data: 120 * 1024, minutes: 0 }
        };
        
        for (const order of orders) {
            const plan = planMapping[order.plan];
            if (plan) {
                totalDataMB += plan.data;
                totalMinutes += plan.minutes;
            }
        }
        
        return {
            balance: 0,  // Mytel doesn't expose balance via API easily
            data: totalDataMB,
            minutes: totalMinutes,
            lastUpdated: new Date().toISOString()
        };
    } catch (e) {
        console.error('Error getting balance:', e);
        return { balance: 0, data: 0, minutes: 0, lastUpdated: new Date().toISOString() };
    }
}

module.exports = { supabase, supabaseAdmin, saveOTP, verifyOTP, getUserBalance };
