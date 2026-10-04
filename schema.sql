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
  exact_location TEXT,
  map_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Rooms Table
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
  max_guests INTEGER DEFAULT 2,
  bed_type VARCHAR(50) DEFAULT 'King Bed',
  amenities TEXT DEFAULT 'Wi-Fi, AC, Smart TV, Room Service',
  status VARCHAR(20) DEFAULT 'available',
  desc TEXT,
  video_url TEXT,
  discount_price INTEGER DEFAULT 0,
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

-- 4. Bookings Table
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

-- 7. Hotel Contact Details Table
CREATE TABLE IF NOT EXISTS contact_details (
  id VARCHAR(50) PRIMARY KEY,
  hotel_id VARCHAR(50) NOT NULL UNIQUE,
  phone VARCHAR(50) NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels (id) ON DELETE CASCADE
);

-- 8. Website Settings Table
CREATE TABLE IF NOT EXISTS website_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Hero Section Settings Table
CREATE TABLE IF NOT EXISTS hero_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Gallery Table
CREATE TABLE IF NOT EXISTS gallery (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(150),
  category VARCHAR(50) DEFAULT 'General',
  image TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Videos Table
CREATE TABLE IF NOT EXISTS videos (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  video_url TEXT NOT NULL,
  is_homepage INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Amenities Table
CREATE TABLE IF NOT EXISTS amenities (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50) DEFAULT 'sparkles',
  category VARCHAR(50) DEFAULT 'General',
  desc TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Offers Table
CREATE TABLE IF NOT EXISTS offers (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  desc TEXT,
  discount VARCHAR(50),
  image TEXT,
  valid_from VARCHAR(20),
  valid_to VARCHAR(20),
  code VARCHAR(50),
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(50) PRIMARY KEY,
  guest_name VARCHAR(100) NOT NULL,
  rating INTEGER DEFAULT 5,
  review_text TEXT NOT NULL,
  guest_image TEXT,
  hotel_tag VARCHAR(100) DEFAULT 'Deepak Hotels Group',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Booking Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(50) PRIMARY KEY,
  booking_id VARCHAR(50) NOT NULL,
  recipient_number VARCHAR(50) NOT NULL,
  notification_type VARCHAR(20) DEFAULT 'sms',
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  provider_message_id TEXT,
  error_message TEXT,
  attempts INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
);

-- -------------------------------------------------------------------------
-- Indexes for Performance & Faster Queries
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rooms_hotel ON rooms (hotel);
CREATE INDEX IF NOT EXISTS idx_bookings_hotel_room ON bookings (hotel_room);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (date);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items (available);
CREATE INDEX IF NOT EXISTS idx_gallery_category ON gallery (category);
CREATE INDEX IF NOT EXISTS idx_offers_active ON offers (is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_booking ON notifications (booking_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications (status);
