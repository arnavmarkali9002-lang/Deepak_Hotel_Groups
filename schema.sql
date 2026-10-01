-- =========================================================================
-- DEEPAK HOTELS GROUP — Relational SQL Database Schema (schema.sql)
-- Complete DDL statements with constraints, foreign keys, and indexes.
-- Compatible with SQLite, PostgreSQL, and MySQL.
-- =========================================================================

-- 1. Hotels Table
CREATE TABLE IF NOT EXISTS hotels (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  tag VARCHAR(100),
  locality TEXT,
  phone VARCHAR(50),
  accent VARCHAR(20),
  image TEXT,
  desc TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Rooms Table (with foreign key reference to hotels)
CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(50) PRIMARY KEY,
  hotel VARCHAR(50) NOT NULL,
  num VARCHAR(20) NOT NULL,
  floor INTEGER DEFAULT 1,
  ac INTEGER DEFAULT 0,
  cat VARCHAR(50) NOT NULL,
  price24 INTEGER NOT NULL CHECK (price24 >= 0),
  price6 INTEGER NOT NULL CHECK (price6 >= 0),
  photo TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel) REFERENCES hotels (id) ON DELETE CASCADE
);

-- 3. Menu Items / Food Orders Table
CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) DEFAULT 'Other',
  price INTEGER NOT NULL CHECK (price >= 0),
  photo TEXT,
  available INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bookings Table (with foreign key reference to rooms)
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(50) PRIMARY KEY,
  hotel_room VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  guests INTEGER DEFAULT 1,
  stay VARCHAR(10) NOT NULL CHECK (stay IN ('24hr', '6hr')),
  date VARCHAR(10) NOT NULL,
  time VARCHAR(10) NOT NULL,
  id_method VARCHAR(20) DEFAULT 'hotel',
  id_photo_base64 TEXT,
  requests TEXT,
  food TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checkedin', 'checkedout', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_room) REFERENCES rooms (id) ON DELETE RESTRICT
);

-- 5. Admins / Authentication Table
CREATE TABLE IF NOT EXISTS admins (
  username VARCHAR(50) PRIMARY KEY,
  salt VARCHAR(100) NOT NULL,
  hash VARCHAR(250) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Key-Value Metadata Storage
CREATE TABLE IF NOT EXISTS metadata (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Hotel Contact & Address Details Table
CREATE TABLE IF NOT EXISTS contact_details (
  id VARCHAR(50) PRIMARY KEY,
  hotel_id VARCHAR(50) NOT NULL UNIQUE,
  phone VARCHAR(50) NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels (id) ON DELETE CASCADE
);


-- -------------------------------------------------------------------------
-- Indexes for Performance & Faster Queries
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rooms_hotel ON rooms (hotel);
CREATE INDEX IF NOT EXISTS idx_bookings_hotel_room ON bookings (hotel_room);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (date);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items (available);
