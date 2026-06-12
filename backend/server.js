const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');           // <-- ADD THIS
const nodemailer = require('nodemailer');
require("dotenv").config();

// ─── Email Setup ───────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: true, // Use SSL for Render
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS
  }
});

const db = require("./config/db");
const productRoutes = require("./routes/productRoutes");
const supplierRoutes = require("./routes/supplierRoutes");

const app = express();

app.use(cors());
app.use(express.json());


// ─── Auth Middleware ───────────────────────────────────────────────────────────
// MUST be defined BEFORE the protected routes below
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ─── Public Routes (no token needed) ──────────────────────────────────────────

// LOGIN
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ success: false, message: "Email and password are required" });

  const query = "SELECT * FROM users WHERE email = ?";

  db.query(query, [email], async (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "Database error" });
    }
    if (results.length === 0)
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    const user = results[0];

    // Compare hashed password
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    // Sign JWT
    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      success: true,
      token,
      user: {
        id:   user.user_id,
        name: user.name,
        role: user.role
      }
    });
  });
});

// SIGNUP
app.post("/api/signup", (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ success: false, message: "Name, email, and password are required" });

  const checkQuery = "SELECT * FROM users WHERE email = ?";

  db.query(checkQuery, [email], async (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "Database error" });
    }
    if (results.length > 0)
      return res.status(409).json({ success: false, message: "Email already exists" });

    // Hash password before storing
    const hashed = await bcrypt.hash(password, 10);

    const insertQuery = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";

    db.query(insertQuery, [name, email, hashed, role || "Staff"], (err2) => {
      if (err2) {
        console.error(err2);
        return res.status(500).json({ success: false, message: "Failed to create account" });
      }
      res.json({ success: true, message: "Account created successfully" });
    });
  });
});

// ─── Protected Routes (token required) ────────────────────────────────────────
app.use("/api/products",  authMiddleware, productRoutes);
app.use("/api/suppliers", authMiddleware, supplierRoutes);

// GET all transactions
app.get("/api/transactions", authMiddleware, (req, res) => {
  const query = `
    SELECT 
      t.transaction_id,
      t.product_id,
      p.product_name,
      t.user_id,
      u.name AS user_name,
      t.transaction_type,
      t.quantity,
      t.transaction_date
    FROM transactions t
    LEFT JOIN products p ON t.product_id = p.product_id
    LEFT JOIN users u ON t.user_id = u.user_id
    ORDER BY t.transaction_date DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// POST add transaction
app.post("/api/transactions", authMiddleware, (req, res) => {
  const { product_id, user_id, transaction_type, quantity } = req.body;

  if (!product_id || !user_id || !transaction_type || !quantity)
    return res.status(400).json({ error: "All fields are required" });

  const qty = Number(quantity);
  if (qty <= 0)
    return res.status(400).json({ error: "Quantity must be greater than 0" });

  const getProductQuery = "SELECT * FROM products WHERE product_id = ?";

  db.query(getProductQuery, [product_id], (err, productResults) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    if (productResults.length === 0)
      return res.status(404).json({ error: "Product not found" });

    const product = productResults[0];
    let newQuantity = Number(product.quantity);

    if (transaction_type === "IN" || transaction_type === "RETURN") {
      newQuantity += qty;
    } else if (transaction_type === "OUT") {
      if (newQuantity < qty)
        return res.status(400).json({ error: "Not enough stock available" });
      newQuantity -= qty;
    } else {
      return res.status(400).json({ error: "Invalid transaction type" });
    }

    const insertQuery = `
      INSERT INTO transactions (product_id, user_id, transaction_type, quantity)
      VALUES (?, ?, ?, ?)
    `;

    db.query(insertQuery, [product_id, user_id, transaction_type, qty], (insertErr) => {
      if (insertErr) {
        console.error(insertErr);
        return res.status(500).json({ error: "Failed to save transaction" });
      }

      const updateQuery = "UPDATE products SET quantity = ? WHERE product_id = ?";

      db.query(updateQuery, [newQuantity, product_id], (updateErr) => {
        if (updateErr) {
          console.error(updateErr);
          return res.status(500).json({ error: "Failed to update stock" });
        }
        res.json({ message: "Transaction saved successfully" });
      });
    });
  });
});

// GET reports summary
app.get("/api/reports/summary", authMiddleware, (req, res) => {
  const summaryQuery = `
    SELECT 
      (SELECT COUNT(*) FROM products) AS total_products,
      (SELECT COUNT(*) FROM suppliers) AS total_suppliers,
      (SELECT COUNT(*) FROM transactions) AS total_transactions,
      (SELECT IFNULL(SUM(quantity * price), 0) FROM products) AS inventory_value,
      (SELECT COUNT(*) FROM products WHERE quantity <= reorder_level) AS low_stock_count
  `;

  const lowStockQuery = `
    SELECT product_id, product_name, category, quantity, reorder_level
    FROM products
    WHERE quantity <= reorder_level
    ORDER BY quantity ASC
  `;

  db.query(summaryQuery, (summaryErr, summaryResults) => {
    if (summaryErr) {
      console.error(summaryErr);
      return res.status(500).json({ error: "Failed to load summary" });
    }

    db.query(lowStockQuery, (lowErr, lowStockResults) => {
      if (lowErr) {
        console.error(lowErr);
        return res.status(500).json({ error: "Failed to load low stock report" });
      }

      res.json({
        summary:  summaryResults[0],
        lowStock: lowStockResults
      });
    });
  });
});

 // ─── Forgot Password Route ────────────────────────────────────────────────────
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const query = 'SELECT user_id, email FROM users WHERE email = ?';
    db.query(query, [email], async (err, users) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      if (users.length === 0) {
        return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
      }

      const user = users[0];
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Calculate expiration time for MySQL DATETIME format (1 hour from now)
      const expireTime = new Date(Date.now() + 3600000).toISOString().slice(0, 19).replace('T', ' ');

      db.query(
        'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE user_id = ?',
        [resetToken, expireTime, user.user_id],
        async (updateErr) => {
          if (updateErr) return res.status(500).json({ error: 'Failed to generate token' });

          const resetLink = `https://stockflow-inventory-araa.onrender.com/reset-password.html?token=${resetToken}`;

          const mailOptions = {
            from: '"StockFlow Support" <noreply@stockflow.com>',
            to: user.email,
            subject: 'Password Reset Request',
            html: `
              <h2>Password Reset</h2>
              <p>You requested a password reset for your StockFlow account.</p>
              <p>Click the link below to set a new password. This link is valid for 1 hour.</p>
              <a href="${resetLink}" style="padding: 10px 15px; background: #01696f; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
              <p>If you did not request this, please ignore this email.</p>
            `
          };

          try {
            await transporter.sendMail(mailOptions);
            res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
          } catch (emailError) {
            console.error("Nodemailer failed to send email:", emailError);
            res.status(500).json({ error: 'Failed to send the email. Check your server terminal.' });
          }
        }
      );
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});

// ─── Reset Password Route ─────────────────────────────────────────────────────
app.post('/api/reset-password', (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }

  try {
    const query = 'SELECT user_id FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()';
    db.query(query, [token], async (err, users) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      if (users.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
      }

      const userId = users[0].user_id;
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      db.query(
        'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE user_id = ?',
        [hashedPassword, userId],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ error: 'Failed to reset password' });
          res.json({ success: true, message: 'Password has been successfully reset.' });
        }
      );
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'An error occurred while resetting your password.' });
  }
});

// ─── Serve Frontend ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "index.html"));
});

// ─── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
