
const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET all suppliers
router.get("/", (req, res) => {
  const query = "SELECT * FROM suppliers ORDER BY supplier_id DESC";

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching suppliers:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// POST add supplier
router.post("/", (req, res) => {
  // 1. Extract EXACTLY what the frontend sends (snake_case)
  const { supplier_name, phone, address } = req.body;

  // 2. Validate using the exact same snake_case variables
  if (!supplier_name || !phone || !address) {
    return res.status(400).json({ error: "All supplier fields are required" });
  }

  const query = `
    INSERT INTO suppliers (supplier_name, phone, address)
    VALUES (?, ?, ?)
  `;

  // 3. Pass the correct variables to the SQL query
  db.query(query, [supplier_name, phone, address], (err, result) => {
    if (err) {
      console.error("Error saving supplier:", err);
      return res.status(500).json({ error: err.message || "Failed to add supplier" });
    }

    res.status(201).json({
      message: "Supplier added successfully!",
      id: result.insertId
    });
  });
});

module.exports = router;