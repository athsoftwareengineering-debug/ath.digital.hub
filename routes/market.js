// routes/market.js - ATH DIGITAL HUB Market Routes
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../database');

// ============================================================
// PRODUCTS ROUTES
// ============================================================

// GET /api/market/products - Get all products
router.get('/products', async (req, res) => {
    console.log('📋 GET /api/market/products - Fetching products...');
    
    try {
        const { data: products, error } = await supabaseAdmin
            .from('products')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        console.log(`✅ Found ${products?.length || 0} products`);
        res.json({ success: true, products: products || [] });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/market/products/:id - Get single product by ID
router.get('/products/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const { data: product, error } = await supabaseAdmin
            .from('products')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        res.json({ success: true, product });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/market/products - Create new product
router.post('/products', async (req, res) => {
    const { name, price, image, category, icon, discount } = req.body;
    
    if (!name || !price) {
        return res.status(400).json({ success: false, error: 'Name and price are required' });
    }
    
    if (isNaN(price) || price <= 0) {
        return res.status(400).json({ success: false, error: 'Price must be a positive number' });
    }
    
    try {
        const { data, error } = await supabaseAdmin
            .from('products')
            .insert([{
                name,
                price: parseInt(price),
                image: image || null,
                category: category || null,
                icon: icon || 'fas fa-box',
                discount: discount || 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        
        console.log(`✅ Product created: ${name}`);
        res.json({ success: true, product: data[0] });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/market/products/:id - Update product
router.put('/products/:id', async (req, res) => {
    const { id } = req.params;
    const { name, price, image, category, icon, discount } = req.body;
    
    if (!name || !price) {
        return res.status(400).json({ success: false, error: 'Name and price are required' });
    }
    
    try {
        const { data, error } = await supabaseAdmin
            .from('products')
            .update({
                name,
                price: parseInt(price),
                image: image || null,
                category: category || null,
                icon: icon || 'fas fa-box',
                discount: discount || 0,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        console.log(`✅ Product updated: ${name}`);
        res.json({ success: true, product: data[0] });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/market/products/:id - Delete product
router.delete('/products/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const { error } = await supabaseAdmin
            .from('products')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        console.log(`✅ Product deleted: ${id}`);
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// CATEGORIES ROUTES
// ============================================================

// GET /api/market/categories - Get all unique categories
router.get('/categories', async (req, res) => {
    try {
        const { data: products, error } = await supabaseAdmin
            .from('products')
            .select('category')
            .not('category', 'is', null);
        
        if (error) throw error;
        
        const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
        res.json({ success: true, categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
