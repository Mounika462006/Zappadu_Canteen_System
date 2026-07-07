import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'database.sqlite');
     
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

// Helper to run SQL promises
export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
};

export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

export const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

async function initializeDatabase() {
  try {
    // Create Users Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('student', 'shop_owner')) NOT NULL,
        sinNumber TEXT,
        shopId TEXT
      )
    `);

    // Create Shops Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS shops (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        image TEXT,
        ownerEmail TEXT,
        isOpen INTEGER DEFAULT 1
      )
    `);

    // Create Menu Items Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        image TEXT,
        category TEXT NOT NULL,
        available INTEGER DEFAULT 1,
        preparationTime INTEGER DEFAULT 10,
        shopId TEXT,
        FOREIGN KEY (shopId) REFERENCES shops(id)
      )
    `);

    // Create Orders Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        studentId TEXT,
        studentName TEXT,
        shopId TEXT,
        shopName TEXT,
        totalAmount REAL NOT NULL,
        status TEXT CHECK(status IN ('pending', 'accepted', 'preparing', 'ready', 'collected', 'cancelled')) DEFAULT 'pending',
        paymentMethod TEXT CHECK(paymentMethod IN ('pay_now', 'pay_later')) NOT NULL,
        paymentStatus TEXT CHECK(paymentStatus IN ('pending', 'paid')) DEFAULT 'pending',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        estimatedReadyTime TEXT,
        aiPrepTimeExplanation TEXT,
        FOREIGN KEY (studentId) REFERENCES users(id),
        FOREIGN KEY (shopId) REFERENCES shops(id)
      )
    `);

    // Create Order Items Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId TEXT,
        menuItemId TEXT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        FOREIGN KEY (orderId) REFERENCES orders(id)
      )
    `);

    console.log('Database tables verified/created successfully.');
    await seedData();
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
  }
}

async function seedData() {
  try {
    // Seed Users
    const userCount = await dbGet('SELECT COUNT(*) as count FROM users');
    if (userCount.count === 0) {
      console.log('Seeding default users...');
      const studentHash = bcrypt.hashSync('student123', 10);
      const ownerHash = bcrypt.hashSync('shop123', 10);

      await dbRun('INSERT INTO users (id, name, email, password_hash, role, sinNumber) VALUES (?, ?, ?, ?, ?, ?)', [
        '1', 'Demo Student', 'student@college.edu', studentHash, 'student', 'SIN001'
      ]);

      await dbRun('INSERT INTO users (id, name, email, password_hash, role, shopId) VALUES (?, ?, ?, ?, ?, ?)', [
        '2', 'Annapurna Owner', 'annapurna@zappadu.com', ownerHash, 'shop_owner', 'shop1'
      ]);

      await dbRun('INSERT INTO users (id, name, email, password_hash, role, shopId) VALUES (?, ?, ?, ?, ?, ?)', [
        '3', 'Spice Junction Owner', 'spicejunction@zappadu.com', ownerHash, 'shop_owner', 'shop2'
      ]);

      await dbRun('INSERT INTO users (id, name, email, password_hash, role, shopId) VALUES (?, ?, ?, ?, ?, ?)', [
        '4', 'Quick Bites Owner', 'quickbites@zappadu.com', ownerHash, 'shop_owner', 'shop3'
      ]);
      console.log('Seeded users.');
    }

    // Seed Shops
    const shopCount = await dbGet('SELECT COUNT(*) as count FROM shops');
    if (shopCount.count === 0) {
      console.log('Seeding default shops...');
      const shops = [
        {
          id: 'shop1',
          name: 'Annapurna South Indian',
          description: 'Authentic South Indian cuisine - Dosa, Idli, Vada & more. Fresh and traditional flavors!',
          image: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=600&h=400&fit=crop',
          ownerEmail: 'annapurna@zappadu.com',
          isOpen: 1
        },
        {
          id: 'shop2',
          name: 'Spice Junction',
          description: 'North Indian favorites - Biryani, Paneer dishes, Chole Bhature & delicious curries!',
          image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&h=400&fit=crop',
          ownerEmail: 'spicejunction@zappadu.com',
          isOpen: 1
        },
        {
          id: 'shop3',
          name: 'Quick Bites & Juice Bar',
          description: 'Snacks, Chinese, Cold drinks & Fresh juices. Perfect for a quick refuel between classes!',
          image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop',
          ownerEmail: 'quickbites@zappadu.com',
          isOpen: 1
        }
      ];

      for (const shop of shops) {
        await dbRun('INSERT INTO shops (id, name, description, image, ownerEmail, isOpen) VALUES (?, ?, ?, ?, ?, ?)', [
          shop.id, shop.name, shop.description, shop.image, shop.ownerEmail, shop.isOpen
        ]);
      }
      console.log('Seeded shops.');
    }

    // Seed Menu Items
    const menuCount = await dbGet('SELECT COUNT(*) as count FROM menu_items');
    if (menuCount.count === 0) {
      console.log('Seeding menu items...');
      const menuItems = [
        // Shop 1
        { id: "1", name: "Masala Dosa", description: "Crispy rice crepe filled with spiced potato filling", price: 50, image: "https://images.unsplash.com/photo-1668236543090-82eb5eaf67e1?w=400&h=300&fit=crop", category: "South Indian", available: 1, preparationTime: 10, shopId: "shop1" },
        { id: "2", name: "Idli Sambar", description: "Soft steamed rice cakes served with lentil soup", price: 35, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&h=300&fit=crop", category: "South Indian", available: 1, preparationTime: 5, shopId: "shop1" },
        { id: "3", name: "Medu Vada", description: "Crispy fried lentil donuts served with sambar", price: 30, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&h=300&fit=crop", category: "South Indian", available: 1, preparationTime: 8, shopId: "shop1" },
        { id: "4", name: "Pongal", description: "Creamy rice and lentil dish tempered with cumin", price: 40, image: "https://images.unsplash.com/photo-1567337710282-00832b415979?w=400&h=300&fit=crop", category: "South Indian", available: 1, preparationTime: 10, shopId: "shop1" },
        { id: "5", name: "Masala Chai", description: "Aromatic Indian spiced tea with milk", price: 15, image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&h=300&fit=crop", category: "Beverages", available: 1, preparationTime: 3, shopId: "shop1" },

        // Shop 2
        { id: "6", name: "Veg Biryani", description: "Fragrant basmati rice cooked with mixed vegetables", price: 80, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop", category: "Rice", available: 1, preparationTime: 15, shopId: "shop2" },
        { id: "7", name: "Paneer Butter Masala", description: "Cottage cheese cubes in rich tomato gravy", price: 90, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=300&fit=crop", category: "North Indian", available: 1, preparationTime: 12, shopId: "shop2" },
        { id: "8", name: "Chole Bhature", description: "Spicy chickpea curry served with fluffy fried bread", price: 60, image: "https://images.unsplash.com/photo-1626132647523-66f6bf15f6f0?w=400&h=300&fit=crop", category: "North Indian", available: 1, preparationTime: 10, shopId: "shop2" },
        { id: "9", name: "Dal Makhani", description: "Slow-cooked black lentils in rich gravy", price: 70, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop", category: "North Indian", available: 1, preparationTime: 12, shopId: "shop2" },
        { id: "10", name: "Chapati (2 pcs)", description: "Soft whole wheat flatbread", price: 20, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop", category: "Breads", available: 1, preparationTime: 5, shopId: "shop2" },

        // Shop 3
        { id: "11", name: "Veg Fried Rice", description: "Stir-fried rice with fresh vegetables", price: 55, image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop", category: "Chinese", available: 1, preparationTime: 8, shopId: "shop3" },
        { id: "12", name: "Veg Noodles", description: "Hakka noodles tossed with vegetables", price: 55, image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=300&fit=crop", category: "Chinese", available: 1, preparationTime: 8, shopId: "shop3" },
        { id: "13", name: "Samosa (2 pcs)", description: "Crispy fried pastry with spiced potatoes", price: 20, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop", category: "Snacks", available: 1, preparationTime: 5, shopId: "shop3" },
        { id: "14", name: "Vada Pav", description: "Mumbai style spiced potato fritter in a bun", price: 25, image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&h=300&fit=crop", category: "Snacks", available: 1, preparationTime: 5, shopId: "shop3" },
        { id: "15", name: "Cold Coffee", description: "Chilled coffee blended with ice cream", price: 40, image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop", category: "Beverages", available: 1, preparationTime: 5, shopId: "shop3" },
        { id: "16", name: "Fresh Lime Soda", description: "Refreshing lemon soda - sweet or salted", price: 25, image: "https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&h=300&fit=crop", category: "Beverages", available: 1, preparationTime: 2, shopId: "shop3" }
      ];

      for (const item of menuItems) {
        await dbRun(
          'INSERT INTO menu_items (id, name, description, price, image, category, available, preparationTime, shopId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [item.id, item.name, item.description, item.price, item.image, item.category, item.available, item.preparationTime, item.shopId]
        );
      }
      console.log('Seeded menu items.');
    }
  } catch (error) {
    console.error('Error seeding data:', error);
  }
}

export default db;
