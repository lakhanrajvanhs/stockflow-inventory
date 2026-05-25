
// new
const mysql = require('mysql2');
require('dotenv').config();

// Create a connection pool instead of a single connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // Pool-specific settings
  waitForConnections: true,
  connectionLimit: 10, // Maximum number of connections in the pool
  queueLimit: 0
});

// Check if the pool connects successfully
db.getConnection((err, connection) => {
  if (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('Database connection was closed.');
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
      console.error('Database has too many connections.');
    }
    if (err.code === 'ECONNREFUSED') {
      console.error('Database connection was refused.');
    }
  } else {
    console.log('Successfully connected to the database pool!');
    connection.release(); // Release the connection back to the pool
  }
});

// Export the pool. 
// Note: If your routes use async/await, you might need to export db.promise() instead.
module.exports = db;