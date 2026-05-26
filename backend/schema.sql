CREATE DATABASE defaultdb;

USE defaultdb;

CREATE TABLE suppliers (
    supplier_id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address TEXT
);

CREATE TABLE products (
    product_id INT PRIMARY KEY AUTO_INCREMENT,
    product_name VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    quantity INT DEFAULT 0,
    price DECIMAL(10,2),
    reorder_level INT DEFAULT 5,
    supplier_id INT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
);

CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    role VARCHAR(50)
);

CREATE TABLE transactions (
    transaction_id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT,
    user_id INT,
    transaction_type ENUM('IN','OUT','RETURN'),
    quantity INT,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
-- 1. Insert Suppliers
INSERT INTO suppliers (supplier_name, phone, address) VALUES 
('TechCorp Electronics', '9876543210', 'Mumbai, India'),
('Office Needs Ltd', '9123456789', 'Bangalore, India');

-- 2. Insert Users (Assuming admin account already exists, add a staff member)
INSERT INTO users (name, email, password, role) VALUES 
('Admin', 'admin1@stockflow.com', '$2b$10$qc9ljEbgvDFhPWyUoJgrR.n8wxVj9EtqKUp3Yv21Cd9.THzv6mrUC','Admin');

-- 3. Insert Products
-- (This links products to the suppliers created in step 1)
INSERT INTO products (product_name, category, quantity, price, reorder_level, supplier_id) VALUES 
('Laptop', 'Electronics', 50, 45000.00, 10, 1),
('Office Chair', 'Furniture', 20, 5500.00, 5, 2),
('Wireless Mouse', 'Electronics', 100, 800.00, 20, 1);

-- 4. Insert Transactions
-- (This links transactions to the products and users created above)
INSERT INTO transactions (product_id, user_id, transaction_type, quantity) VALUES 
(1, 1, 'IN', 50),
(2, 1, 'IN', 20),
(3, 1, 'IN', 100);





-- Check your new data
SELECT * FROM suppliers;
SELECT * FROM users;
SELECT * FROM products;
SELECT * FROM transactions;