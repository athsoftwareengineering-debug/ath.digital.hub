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

function saveOTP(phone, otp) {
    otpStore.set(phone, {
        code: otp,
        expiresAt: Date.now() + 5 * 60 * 1000
    });
    setTimeout(() => {
        if (otpStore.get(phone)?.expiresAt < Date.now()) {
            otpStore.delete(phone);
        }
    }, 5 * 60 * 1000);
}

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

module.exports = { supabase, supabaseAdmin, saveOTP, verifyOTP };
