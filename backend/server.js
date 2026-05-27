const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require("dotenv").config();

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
