import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { dbRun, dbGet, dbAll } from './db.js';
import { predictPrepTime, getModelMetrics } from './ai/prepTimePredictor.js';
import { getRecommendations } from './ai/foodRecommender.js';
import { handleChatQuery } from './ai/canteenChatbot.js';

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'zappadu_super_secret_jwt_key_123!';

// Middlewares
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8080', 'http://127.0.0.1:8080'],
  credentials: true
}));
app.use(express.json());

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalid or expired' });
    }
    req.user = user;
    next();
  });
};

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

// Register Student
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, sinNumber } = req.body;

  if (!name || !email || !password || !sinNumber) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existing = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const id = Date.now().toString();
    const hash = bcrypt.hashSync(password, 10);

    await dbRun(
      'INSERT INTO users (id, name, email, password_hash, role, sinNumber) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, email, hash, 'student', sinNumber]
    );

    const user = { id, name, email, role: 'student', sinNumber };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(500).json({ error: 'Registration failed due to a server error' });
  }
});

// Login (Student & Shop Owner)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const userRow = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!userRow) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isValid = bcrypt.compareSync(password, userRow.password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
      sinNumber: userRow.sinNumber || undefined,
      shopId: userRow.shopId || undefined
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Login failed due to a server error' });
  }
});

// Get Current User Profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userRow = await dbGet('SELECT id, name, email, role, sinNumber, shopId FROM users WHERE id = ?', [req.user.id]);
    if (!userRow) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: userRow });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// ==========================================
// 2. CANTEEN SHOP & MENU ENDPOINTS
// ==========================================

// Get All Shops
app.get('/api/shops', async (req, res) => {
  try {
    const shops = await dbAll('SELECT * FROM shops');
    // Map SQLite 1/0 back to boolean for React
    const formatted = shops.map(s => ({ ...s, isOpen: s.isOpen === 1 }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shops' });
  }
});

// Get Menu by Shop ID
app.get('/api/shops/:shopId/menu', async (req, res) => {
  const { shopId } = req.params;
  try {
    const menuItems = await dbAll('SELECT * FROM menu_items WHERE shopId = ?', [shopId]);
    const formatted = menuItems.map(item => ({ ...item, available: item.available === 1 }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

// Toggle Shop Status (Open/Closed)
app.put('/api/shops/:shopId/status', authenticateToken, async (req, res) => {
  const { shopId } = req.params;
  const { isOpen } = req.body;

  if (req.user.role !== 'shop_owner' || req.user.shopId !== shopId) {
    return res.status(403).json({ error: 'Unauthorized to manage this shop' });
  }

  try {
    await dbRun('UPDATE shops SET isOpen = ? WHERE id = ?', [isOpen ? 1 : 0, shopId]);
    res.json({ message: `Shop is now ${isOpen ? 'Open' : 'Closed'}`, isOpen });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update shop status' });
  }
});

// ==========================================
// 3. ORDER ENDPOINTS WITH AI PREDICTION
// ==========================================

// Create Order (AI Prep-Time calculated here)
app.post('/api/orders', authenticateToken, async (req, res) => {
  const { items, paymentMethod, shopId } = req.body;

  if (!items || items.length === 0 || !shopId) {
    return res.status(400).json({ error: 'Invalid order payloads' });
  }

  try {
    // 1. Retrieve Shop details
    const shop = await dbGet('SELECT * FROM shops WHERE id = ?', [shopId]);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    // 2. Fetch current number of active/preparing orders in queue for this shop
    const queueQuery = `
      SELECT COUNT(*) as activeCount 
      FROM orders 
      WHERE shopId = ? AND status IN ('pending', 'accepted', 'preparing')
    `;
    const queueData = await dbGet(queueQuery, [shopId]);
    const activeOrdersQueueCount = queueData.activeCount;

    // 3. Calculate order total amount and max item preparation time complexity
    let totalAmount = 0;
    let maxBasePrepTime = 0;

    for (const item of items) {
      totalAmount += item.menuItem.price * item.quantity;
      if (item.menuItem.preparationTime > maxBasePrepTime) {
        maxBasePrepTime = item.menuItem.preparationTime;
      }
    }

    // 4. CALL THE AI DATA SCIENCE REGRESSION ENGINE
    const aiEstimation = predictPrepTime(maxBasePrepTime, activeOrdersQueueCount);
    const predictedMinutes = aiEstimation.predictedMinutes;
    const aiExplanation = JSON.stringify(aiEstimation.explanation);

    const orderId = `ORD${Date.now().toString().slice(-6)}`;
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;
    
    // Calculate estimated ready date
    const readyTimeObj = new Date(Date.now() + predictedMinutes * 60 * 1000);
    const estimatedReadyTime = readyTimeObj.toISOString();

    const paymentStatus = paymentMethod === 'pay_now' ? 'paid' : 'pending';

    // 5. Save the Order to SQL Database
    await dbRun(`
      INSERT INTO orders (id, studentId, studentName, shopId, shopName, totalAmount, status, paymentMethod, paymentStatus, createdAt, updatedAt, estimatedReadyTime, aiPrepTimeExplanation) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderId, req.user.id, req.user.name, shopId, shop.name, totalAmount, 'pending', paymentMethod, paymentStatus, createdAt, updatedAt, estimatedReadyTime, aiExplanation
    ]);

    // 6. Save each individual item into order_items table
    for (const item of items) {
      await dbRun(`
        INSERT INTO order_items (orderId, menuItemId, name, price, quantity) 
        VALUES (?, ?, ?, ?, ?)
      `, [orderId, item.menuItem.id, item.menuItem.name, item.menuItem.price, item.quantity]);
    }

    // Assemble completed Order Object for response
    const createdOrder = {
      id: orderId,
      items,
      totalAmount,
      status: 'pending',
      paymentMethod,
      paymentStatus,
      createdAt,
      updatedAt,
      estimatedReadyTime,
      aiPrepTimeExplanation: aiEstimation.explanation,
      studentId: req.user.id,
      studentName: req.user.name,
      shopId,
      shopName: shop.name
    };

    res.status(201).json(createdOrder);
  } catch (error) {
    console.error('Failed to place order:', error);
    res.status(500).json({ error: 'Failed to place order due to a server error' });
  }
});

// Get Student Orders
app.get('/api/orders/student/:studentId', authenticateToken, async (req, res) => {
  const { studentId } = req.params;

  if (req.user.role !== 'student' || req.user.id !== studentId) {
    return res.status(403).json({ error: 'Unauthorized to view these orders' });
  }

  try {
    const orders = await dbAll('SELECT * FROM orders WHERE studentId = ? ORDER BY createdAt DESC', [studentId]);
    const fullOrders = [];

    for (const order of orders) {
      const items = await dbAll('SELECT menuItemId as id, name, price, quantity FROM order_items WHERE orderId = ?', [order.id]);
      
      // Reconstruct React structure: array of CartItems
      const cartItems = items.map(it => ({
        menuItem: { id: it.id, name: it.name, price: it.price },
        quantity: it.quantity
      }));

      let aiExpl = null;
      try {
        aiExpl = order.aiPrepTimeExplanation ? JSON.parse(order.aiPrepTimeExplanation) : null;
      } catch (e) {
        aiExpl = null;
      }

      fullOrders.push({
        ...order,
        items: cartItems,
        aiPrepTimeExplanation: aiExpl
      });
    }

    res.json(fullOrders);
  } catch (error) {
    console.error('Failed to fetch student orders:', error);
    res.status(500).json({ error: 'Failed to fetch student orders' });
  }
});

// Get Shop Orders (Active and Past)
app.get('/api/orders/shop/:shopId', authenticateToken, async (req, res) => {
  const { shopId } = req.params;

  if (req.user.role !== 'shop_owner' || req.user.shopId !== shopId) {
    return res.status(403).json({ error: 'Unauthorized to view these orders' });
  }

  try {
    const orders = await dbAll('SELECT * FROM orders WHERE shopId = ? ORDER BY createdAt DESC', [shopId]);
    const fullOrders = [];

    for (const order of orders) {
      const items = await dbAll('SELECT menuItemId as id, name, price, quantity FROM order_items WHERE orderId = ?', [order.id]);
      
      const cartItems = items.map(it => ({
        menuItem: { id: it.id, name: it.name, price: it.price },
        quantity: it.quantity
      }));

      let aiExpl = null;
      try {
        aiExpl = order.aiPrepTimeExplanation ? JSON.parse(order.aiPrepTimeExplanation) : null;
      } catch (e) {
        aiExpl = null;
      }

      fullOrders.push({
        ...order,
        items: cartItems,
        aiPrepTimeExplanation: aiExpl
      });
    }

    res.json(fullOrders);
  } catch (error) {
    console.error('Failed to fetch shop orders:', error);
    res.status(500).json({ error: 'Failed to fetch shop orders' });
  }
});

// Update Order Status (Shop Owner modifies order flow)
app.put('/api/orders/:orderId/status', authenticateToken, async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'accepted', 'preparing', 'ready', 'collected', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid order status' });
  }

  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Permissions check
    if (req.user.role === 'shop_owner' && req.user.shopId !== order.shopId) {
      return res.status(403).json({ error: 'Unauthorized to manage this order' });
    }

    const updatedAt = new Date().toISOString();
    let paymentStatusUpdate = order.paymentStatus;
    if (status === 'collected' && order.paymentMethod === 'pay_later') {
      paymentStatusUpdate = 'paid';
    }

    await dbRun(
      'UPDATE orders SET status = ?, paymentStatus = ?, updatedAt = ? WHERE id = ?',
      [status, paymentStatusUpdate, updatedAt, orderId]
    );

    res.json({ message: `Order updated to ${status}`, status, paymentStatus: paymentStatusUpdate });
  } catch (error) {
    console.error('Failed to update order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ==========================================
// 4. AI & DATA SCIENCE SPECIFIC ENDPOINTS
// ==========================================

// Get Personalized Recommendations (Cosine Similarity Engine)
app.get('/api/ai/recommendations', authenticateToken, async (req, res) => {
  try {
    const recs = await getRecommendations(req.user.id);
    res.json(recs);
  } catch (error) {
    console.error('Failed to calculate recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// Post Chatbot query (NLP constraint parsing & triggers)
app.post('/api/ai/chatbot', async (req, res) => {
  const { message, studentId } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  try {
    const chatResult = await handleChatQuery(message, studentId || null);
    res.json(chatResult);
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({ error: 'Chatbot error' });
  }
});

// Fetch Linear Regression Model Weights & Metrics
app.get('/api/ai/prep-time-model', async (req, res) => {
  try {
    const metrics = getModelMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read machine learning model stats' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Zappadu Backend listening at http://localhost:${PORT}`);
});
