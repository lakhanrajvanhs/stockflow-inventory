const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,        // ← ADD THIS
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false        // ← ADD THIS (Aiven requires SSL)
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error('DB Connection Error:', err.message);
  } else {
    console.log('Successfully connected to the database pool!');
    connection.release();
  }
});

module.exports = db;