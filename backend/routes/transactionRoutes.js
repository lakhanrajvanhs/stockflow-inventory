const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET all transactions
router.get('/', async (req, res) => {
  try {
    const [results] = await db.query(`
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
    `);
    res.json(results);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST add transaction
router.post('/', async (req, res) => {
  const { product_id, user_id, transaction_type, quantity } = req.body;

  if (!product_id || !user_id || !transaction_type || !quantity) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const qty = Number(quantity);
  if (qty <= 0) {
    return res.status(400).json({ error: 'Quantity must be greater than 0' });
  }

  try {
    const [productResults] = await db.query('SELECT * FROM products WHERE product_id = ?', [product_id]);

    if (productResults.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResults[0];
    let newQuantity = Number(product.quantity);

    if (transaction_type === 'IN' || transaction_type === 'RETURN') {
      newQuantity += qty;
    } else if (transaction_type === 'OUT') {
      if (newQuantity < qty) {
        return res.status(400).json({ error: 'Not enough stock available' });
      }
      newQuantity -= qty;
    } else {
      return res.status(400).json({ error: 'Invalid transaction type' });
    }

    await db.query(
      'INSERT INTO transactions (product_id, user_id, transaction_type, quantity) VALUES (?, ?, ?, ?)',
      [product_id, user_id, transaction_type, qty]
    );

    await db.query('UPDATE products SET quantity = ? WHERE product_id = ?', [newQuantity, product_id]);

    res.json({ message: 'Transaction saved successfully' });
  } catch (err) {
    console.error('Error saving transaction:', err);
    res.status(500).json({ error: 'Failed to save transaction' });
  }
});

module.exports = router;
