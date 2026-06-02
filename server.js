const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Supabase setup (သင့် credentials ထည့်ပါ)
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    res.json({ success: true, message: 'Database connected' });
  } catch (error) {
    console.error('DB Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send message API
app.post('/api/chat/send', async (req, res) => {
  try {
    console.log('📨 Received:', req.body);
    
    const { message, userId, role, sessionId } = req.body;
    
    // Validation
    if (!message || !userId) {
      return res.status(400).json({ 
        error: 'Missing required fields: message and userId' 
      });
    }
    
    // Insert to Supabase
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([
        {
          message: message,
          user_id: userId,
          role: role || 'customer',
          session_id: sessionId || userId,
          created_at: new Date().toISOString()
        }
      ])
      .select();
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('✅ Message saved:', data);
    res.json({ success: true, data: data });
    
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Get messages API
app.get('/api/chat/messages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    res.json({ success: true, data: data });
    
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all conversations for admin
app.get('/api/chat/conversations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('user_id, role, message, created_at')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Group by user_id
    const conversations = {};
    data.forEach(msg => {
      if (!conversations[msg.user_id]) {
        conversations[msg.user_id] = [];
      }
      conversations[msg.user_id].push(msg);
    });
    
    res.json({ success: true, data: conversations });
    
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Global error:', err);
  res.status(500).json({ 
    error: 'Something went wrong',
    message: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Store: http://localhost:${PORT}/index.html`);
  console.log(`👨‍💼 Admin: http://localhost:${PORT}/admin.html`);
});
