-- =========================================================================
-- DEEPAK HOTELS GROUP — Supabase PostgreSQL Production Schema
-- Compatible with Supabase SQL Editor (PostgreSQL 15+)
-- Run this complete script in your Supabase SQL Editor in one click.
-- =========================================================================

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- 1. Hotels Table (Properties)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hotels (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  tag VARCHAR(100),
  locality TEXT,
  phone VARCHAR(50),
  accent VARCHAR(20) DEFAULT '#E8A33D',
  image TEXT,
  "desc" TEXT,
  exact_location TEXT,
  map_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 2. Rooms & Suites Inventory
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(50) PRIMARY KEY,
  hotel VARCHAR(50) NOT NULL REFERENCES hotels (id) ON DELETE CASCADE,
  num VARCHAR(20) NOT NULL,
  floor INTEGER DEFAULT 1,
  ac BOOLEAN DEFAULT false,
  cat VARCHAR(50) NOT NULL,
  price24 INTEGER NOT NULL CHECK (price24 >= 0),
  price6 INTEGER NOT NULL CHECK (price6 >= 0),
  photo TEXT,
  max_guests INTEGER DEFAULT 2,
  bed_type VARCHAR(50) DEFAULT 'King Bed',
  amenities TEXT DEFAULT 'Wi-Fi, AC, Smart TV, Room Service',
  status VARCHAR(20) DEFAULT 'available',
  "desc" TEXT,
  video_url TEXT,
  discount_price INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 3. Dining Menu Items (Pure Veg Restaurant & Room Dining)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) DEFAULT 'Other',
  price INTEGER NOT NULL CHECK (price >= 0),
  photo TEXT,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 4. Bookings & Reservations
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(50) PRIMARY KEY,
  hotel_room VARCHAR(50) NOT NULL REFERENCES rooms (id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  guests INTEGER DEFAULT 1,
  stay VARCHAR(10) NOT NULL,
  date VARCHAR(10) NOT NULL,
  time VARCHAR(10) NOT NULL,
  id_method VARCHAR(20) DEFAULT 'hotel',
  id_photo_base64 TEXT,
  requests TEXT,
  food JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 5. Admin Authentication
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  username VARCHAR(50) PRIMARY KEY,
  salt VARCHAR(100) NOT NULL,
  hash VARCHAR(250) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 6. Website Global Settings (Branding, Contact, Logo)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS website_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 7. Hero Banner Settings
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hero_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 8. Amenities Catalog
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amenities (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50) DEFAULT 'sparkles',
  category VARCHAR(50) DEFAULT 'General',
  "desc" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 9. Offers & Promo Deals
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offers (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  "desc" TEXT,
  discount VARCHAR(50),
  image TEXT,
  valid_from VARCHAR(20),
  valid_to VARCHAR(20),
  code VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 10. Guest Reviews & Ratings
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(50) PRIMARY KEY,
  guest_name VARCHAR(100) NOT NULL,
  rating INTEGER DEFAULT 5,
  review_text TEXT NOT NULL,
  guest_image TEXT,
  hotel_tag VARCHAR(100) DEFAULT 'Deepak Hotels Group',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 11. Photo Gallery
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gallery (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(150),
  category VARCHAR(50) DEFAULT 'General',
  image TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 12. Hotel Video Tours
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  video_url TEXT NOT NULL,
  is_homepage BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 13. Notifications Logs (WhatsApp & SMS)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(50) PRIMARY KEY,
  booking_id VARCHAR(50),
  recipient_number VARCHAR(50) NOT NULL,
  notification_type VARCHAR(20) DEFAULT 'sms',
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  provider_message_id TEXT,
  error_message TEXT,
  attempts INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- -------------------------------------------------------------------------
-- 14. System Metadata
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metadata (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- Performance Indexes
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rooms_hotel ON rooms (hotel);
CREATE INDEX IF NOT EXISTS idx_bookings_hotel_room ON bookings (hotel_room);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_notifications_booking ON notifications (booking_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications (status);
CREATE INDEX IF NOT EXISTS idx_gallery_order ON gallery (display_order);

-- -------------------------------------------------------------------------
-- Row Level Security (RLS) Configuration
-- -------------------------------------------------------------------------
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata ENABLE ROW LEVEL SECURITY;

-- Public READ policies (allows website visitors to view properties, rooms, menus, offers, reviews, gallery)
CREATE POLICY "Public can view hotels" ON hotels FOR SELECT USING (true);
CREATE POLICY "Public can view rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Public can view menu_items" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Public can view offers" ON offers FOR SELECT USING (true);
CREATE POLICY "Public can view reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Public can view gallery" ON gallery FOR SELECT USING (true);
CREATE POLICY "Public can view videos" ON videos FOR SELECT USING (true);
CREATE POLICY "Public can view amenities" ON amenities FOR SELECT USING (true);
CREATE POLICY "Public can view website_settings" ON website_settings FOR SELECT USING (true);
CREATE POLICY "Public can view hero_settings" ON hero_settings FOR SELECT USING (true);

-- Public CREATE policies (allows visitors to book rooms)
CREATE POLICY "Public can create bookings" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can create notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Service Role policies (full read/write access for backend API)
CREATE POLICY "Service role full access hotels" ON hotels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access rooms" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access menu_items" ON menu_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access bookings" ON bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access admins" ON admins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access website_settings" ON website_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access hero_settings" ON hero_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access amenities" ON amenities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access offers" ON offers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access reviews" ON reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access gallery" ON gallery FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access videos" ON videos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access metadata" ON metadata FOR ALL USING (true) WITH CHECK (true);

-- -------------------------------------------------------------------------
-- Enable Supabase Realtime for instant updates
-- -------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
  ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  ALTER PUBLICATION supabase_realtime ADD TABLE hotels;
  ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
  ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
  ALTER PUBLICATION supabase_realtime ADD TABLE offers;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- -------------------------------------------------------------------------
-- Default Seed Properties
-- -------------------------------------------------------------------------
INSERT INTO hotels (id, name, tag, locality, phone, accent, image, "desc", exact_location, map_url)
VALUES
  ('sv1', 'Hotel Sai View', 'The Original Luxury Wing', 'Vivekanand nagar, Nagar, Manmad Rd, near S T Bus stand, near Holiday Park, Sai Nagar, Shirdi, Maharashtra 423109', '+91 98514 15415', '#E8A33D', '/images/hotel-sai-view.jpg', 'Our flagship luxury property featuring 10 executive rooms, 24/7 dining, and panoramic temple views.', 'hotel sai view ,Vivekanand nagar, Nagar, Manmad Rd, near S T Bus stand, near Holiday Park, Sai Nagar, Shirdi, Maharashtra 423109 QF6H+93 Shirdi, Maharashtra', 'https://www.google.com/maps/search/?api=1&query=hotel%20sai%20view%20%2CVivekanand%20nagar%2C%20Nagar%20Manmad%20Rd%2C%20near%20S%20T%20Bus%20stand%2C%20near%20Holiday%20Park%2C%20Sai%20Nagar%2C%20Shirdi%2C%20Maharashtra%20423109%20QF6H%2B93%20Shirdi%2C%20Maharashtra'),
  ('sv2', 'Hotel Sai Santosh', 'The Grand Family Wing', 'QF6H+WH7 city market, road gaikwad chowk, near addarsha school, Shirdi, Maharashtra 423109', '+91 83293 21838', '#2F6E62', '/images/hotel-sai-santosh.jpg', 'A serene sanctuary popular with families, 20 spacious suites with private courtyard and ample parking.', 'hotel sai santosh, QF6H+WH7 city market, road gaikwad chowk, near addarsha school, Shirdi, Maharashtra 423109', 'https://www.google.com/maps/search/?api=1&query=hotel%20sai%20santosh%2C%20QF6H%2BWH7%20city%20market%2C%20road%20gaikwad%20chowk%2C%20near%20addarsha%20school%2C%20Shirdi%2C%20Maharashtra%20423109'),
  ('sv3', 'Hotel Om Sai', 'The Highway Express Stop', 'Vivekanand Nagar, Nagar, Manmad Rd, Sai Nagar, Shirdi, Maharashtra 423109 QF6G+9W Shirdi, Maharashtra', '+91 90227 51848', '#7C2D2D', '/images/hotel-om-sai.jpg', 'Modern high-comfort express hotel for travellers, 10 rooms with instant 6-hour & 24-hour check-in.', 'hotel om sai, Vivekanand Nagar, Nagar, Manmad Rd, Sai Nagar, Shirdi, Maharashtra 423109 QF6G+9W Shirdi, Maharashtra', 'https://www.google.com/maps/search/?api=1&query=hotel%20om%20sai%2C%20Vivekanand%20Nagar%2C%20Nagar%2C%20Manmad%20Rd%2C%20Sai%20Nagar%2C%20Shirdi%2C%20Maharashtra%20423109%20QF6G%2B9W%20Shirdi%2C%20Maharashtra')
ON CONFLICT (id) DO NOTHING;
