/**
 * Run this script to generate a bcrypt hash for any password.
 * Usage: node hash-password.js
 *
 * Use the output hash to seed your database manually if needed.
 */

const bcrypt = require('bcrypt');

const password = 'password123'; // Change this to whatever you want
const saltRounds = 10;

bcrypt.hash(password, saltRounds).then(hash => {
  console.log('\n✅ Bcrypt hash for:', password);
  console.log(hash);
  console.log('\nPaste this into your SQL INSERT or UPDATE query.\n');
});
