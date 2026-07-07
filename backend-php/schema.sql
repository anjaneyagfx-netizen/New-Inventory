-- MySQL 8+ / MariaDB 10.5+
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(32) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('owner','manager','staff') NOT NULL DEFAULT 'staff',
  warehouse_ids JSON NOT NULL,
  created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouses (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NULL,
  created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  warehouse_id VARCHAR(32) NOT NULL,
  created DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cat (warehouse_id, name),
  INDEX idx_wh (warehouse_id)
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(32) NULL,
  warehouse_id VARCHAR(32) NOT NULL,
  sheets DOUBLE NOT NULL DEFAULT 0,
  uMolding DOUBLE NOT NULL DEFAULT 0,
  lMolding DOUBLE NOT NULL DEFAULT 0,
  image LONGTEXT NULL,
  created DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_item (warehouse_id, name),
  INDEX idx_wh (warehouse_id),
  INDEX idx_cat (category)
);

CREATE TABLE IF NOT EXISTS sales (
  id VARCHAR(32) PRIMARY KEY,
  bill_number VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  customer_name VARCHAR(255) NULL,
  itemId VARCHAR(32) NOT NULL,
  sheets_sale DOUBLE NOT NULL DEFAULT 0,
  u_molding_sale DOUBLE NOT NULL DEFAULT 0,
  l_molding_sale DOUBLE NOT NULL DEFAULT 0,
  price_per_sheet DOUBLE NOT NULL DEFAULT 0,
  price_per_u_molding DOUBLE NOT NULL DEFAULT 0,
  price_per_l_molding DOUBLE NOT NULL DEFAULT 0,
  total_price DOUBLE NOT NULL DEFAULT 0,
  warehouse_id VARCHAR(32) NOT NULL,
  userId VARCHAR(32) NULL,
  created DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bill (bill_number),
  INDEX idx_wh (warehouse_id),
  INDEX idx_item (itemId)
);

CREATE TABLE IF NOT EXISTS purchases (
  id VARCHAR(32) PRIMARY KEY,
  bill_number VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  supplier_name VARCHAR(255) NULL,
  itemId VARCHAR(32) NOT NULL,
  sheets_purchase DOUBLE NOT NULL DEFAULT 0,
  u_molding_purchase DOUBLE NOT NULL DEFAULT 0,
  l_molding_purchase DOUBLE NOT NULL DEFAULT 0,
  price_per_sheet DOUBLE NOT NULL DEFAULT 0,
  price_per_u_molding DOUBLE NOT NULL DEFAULT 0,
  price_per_l_molding DOUBLE NOT NULL DEFAULT 0,
  total_price DOUBLE NOT NULL DEFAULT 0,
  warehouse_id VARCHAR(32) NOT NULL,
  userId VARCHAR(32) NULL,
  created DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bill (bill_number),
  INDEX idx_wh (warehouse_id),
  INDEX idx_item (itemId)
);
