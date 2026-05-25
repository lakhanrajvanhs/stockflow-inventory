


const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET all products
router.get("/", (req, res) => {
  const query = "SELECT * FROM products ORDER BY product_id DESC";

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching products:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// POST add product
router.post("/", (req, res) => {
  const { product_name, category, quantity, price, reorder_level, supplier_id } = req.body;
  
  // Validate using exact snake_case variables and checking for undefined to allow "0"
  if (!product_name || !category || quantity === undefined || price === undefined || reorder_level === undefined || supplier_id === undefined) {
    return res.status(400).json({ error: "All product fields are required" });
  }

  const query = `
    INSERT INTO products 
    (product_name, category, quantity, price, reorder_level, supplier_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [product_name, category, quantity, price, reorder_level, supplier_id],
    (err, result) => {
      if (err) {
        console.error("Error saving product:", err);
        return res.status(500).json({ error: err.message || "Failed to save product" });
      }

      res.status(201).json({
        message: "Product saved successfully!",
        id: result.insertId
      });
    }
  );
});

// DELETE a product
router.delete("/:id", (req, res) => {
  const productId = req.params.id;
  const query = "DELETE FROM products WHERE product_id = ?";

  db.query(query, [productId], (err, result) => {
    if (err) {
      console.error("Error deleting product:", err);
      // Safety check: Prevent deleting products that have transaction history
      if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({ error: "Cannot delete this product because it has recorded transactions." });
      }
      return res.status(500).json({ error: "Failed to delete product" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  });
});

module.exports = router;