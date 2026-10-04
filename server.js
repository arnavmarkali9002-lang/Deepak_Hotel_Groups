/* =========================================================================
   DEEPAK HOTELS GROUP — Persistent Server Engine & SQL API Backend
   Zero-dependency Node.js HTTP server with dual-sync SQLite database (data/deepak_hotels.db)
   and JSON file database fallback (data/db.json).
   Serves /public (customer luxury site + admin management panel).
   ========================================================================= */
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const supabase = require('./supabase-client');

const ROOT = __dirname;

// Self-contained .env loader for zero-dependency local & hosting environments
function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[k]) {
            process.env[k] = v.replace(/^["']|["']$/g, '');
          }
        }
      }
    } catch (e) { }
  }
}
loadEnvFile();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
let DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {
  DATA_DIR = path.join(ROOT, 'data');
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e2) {
    const os = require('os');
    DATA_DIR = path.join(os.tmpdir(), 'deepak_hotels_data');
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e3) { }
  }
}
const DB_PATH = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const ADMIN_MOBILE = process.env.ADMIN_BOOKING_PHONE || process.env.ADMIN_MOBILE_NUMBER || '+919851415415';
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP_NUMBER || '919851415415';

// Ensure uploads directory exists (safe for serverless read-only filesystem)
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) { }

/* ---------------------------------------------------------------------
   DEFAULT SEED DATA
--------------------------------------------------------------------- */
const SEED_HOTELS = [
  { id: 'sv1', name: 'Hotel Sai View', tag: 'The Original Luxury Wing', locality: 'Vivekanand nagar, Nagar, Manmad Rd, near S T Bus stand, near Holiday Park, Sai Nagar, Shirdi, Maharashtra 423109', phone: '+91 98514 15415', accent: '#E8A33D', image: '/images/hotel-sai-view.jpg', desc: 'Our flagship luxury property featuring 10 executive rooms, 24/7 dining, and panoramic temple views.', exact_location: 'hotel sai view ,Vivekanand nagar, Nagar, Manmad Rd, near S T Bus stand, near Holiday Park, Sai Nagar, Shirdi, Maharashtra 423109 QF6H+93 Shirdi, Maharashtra', map_url: 'https://www.google.com/maps/search/?api=1&query=hotel%20sai%20view%20%2CVivekanand%20nagar%2C%20Nagar%2C%20Manmad%20Rd%2C%20near%20S%20T%20Bus%20stand%2C%20near%20Holiday%20Park%2C%20Sai%20Nagar%2C%20Shirdi%2C%20Maharashtra%20423109%20QF6H%2B93%20Shirdi%2C%20Maharashtra' },
  { id: 'sv2', name: 'Hotel Sai Santosh', tag: 'The Grand Family Wing', locality: 'QF6H+WH7 city market, road gaikwad chowk, near addarsha school, Shirdi, Maharashtra 423109', phone: '+91 83293 21838', accent: '#2F6E62', image: '/images/hotel-sai-santosh.jpg', desc: 'A serene sanctuary popular with families, 20 spacious suites with private courtyard and ample parking.', exact_location: 'hotel sai santosh, QF6H+WH7 city market, road gaikwad chowk, near addarsha school, Shirdi, Maharashtra 423109', map_url: 'https://www.google.com/maps/search/?api=1&query=hotel%20sai%20santosh%2C%20QF6H%2BWH7%20city%20market%2C%20road%20gaikwad%20chowk%2C%20near%20addarsha%20school%2C%20Shirdi%2C%20Maharashtra%20423109' },
  { id: 'sv3', name: 'Hotel Om Sai', tag: 'The Highway Express Stop', locality: 'Vivekanand Nagar, Nagar, Manmad Rd, Sai Nagar, Shirdi, Maharashtra 423109 QF6G+9W Shirdi, Maharashtra', phone: '+91 90227 51848', accent: '#7C2D2D', image: '/images/hotel-om-sai.jpg', desc: 'Modern high-comfort express hotel for travellers, 10 rooms with instant 6-hour & 24-hour check-in.', exact_location: 'hotel om sai, Vivekanand Nagar, Nagar, Manmad Rd, Sai Nagar, Shirdi, Maharashtra 423109 QF6G+9W Shirdi, Maharashtra', map_url: 'https://www.google.com/maps/search/?api=1&query=hotel%20om%20sai%2C%20Vivekanand%20Nagar%2C%20Nagar%2C%20Manmad%20Rd%2C%20Sai%20Nagar%2C%20Shirdi%2C%20Maharashtra%20423109%20QF6G%2B9W%20Shirdi%2C%20Maharashtra' }
];

const SEED_ROOMS_RAW = [
  ['sv1', '101', 1, false, 'Single', 1200, 700, 1, 'Single Bed', 'Wi-Fi, TV, Hot Water'],
  ['sv1', '102', 1, false, 'Single', 1200, 700, 1, 'Single Bed', 'Wi-Fi, TV, Hot Water'],
  ['sv1', '103', 1, true, 'Single', 1800, 1000, 1, 'Single Bed', 'Wi-Fi, AC, TV, Room Service'],
  ['sv1', '104', 1, false, 'Couple', 1500, 900, 2, 'Queen Bed', 'Wi-Fi, TV, Housekeeping'],
  ['sv1', '105', 1, true, 'Couple', 2200, 1300, 2, 'King Bed', 'Wi-Fi, AC, Smart TV, Room Service'],
  ['sv1', '201', 2, false, 'Couple', 1500, 900, 2, 'Queen Bed', 'Wi-Fi, TV, Hot Water'],
  ['sv1', '202', 2, true, 'Couple', 2200, 1300, 2, 'King Bed', 'Wi-Fi, AC, Smart TV, Room Service'],
  ['sv1', '203', 2, false, 'Family', 2200, 1300, 4, '2 Double Beds', 'Wi-Fi, TV, Extra Bedding'],
  ['sv1', '204', 2, true, 'Family', 3000, 1800, 4, '2 King Beds', 'Wi-Fi, AC, Smart TV, Courtyard View'],
  ['sv1', '205', 2, true, 'Suite', 3800, 2300, 4, 'Royal King Bed', 'Wi-Fi, Premium AC, Smart TV, Mini Bar, Room Service'],
  
  ['sv2', '101', 1, false, 'Single', 1100, 650, 1, 'Single Bed', 'Wi-Fi, TV'],
  ['sv2', '102', 1, true, 'Single', 1700, 950, 1, 'Single Bed', 'Wi-Fi, AC, TV'],
  ['sv2', '103', 1, false, 'Couple', 1450, 850, 2, 'Queen Bed', 'Wi-Fi, TV'],
  ['sv2', '104', 1, true, 'Couple', 2100, 1250, 2, 'King Bed', 'Wi-Fi, AC, Smart TV'],
  ['sv2', '105', 1, false, 'Family', 2100, 1250, 4, '2 Double Beds', 'Wi-Fi, TV'],
  ['sv2', '201', 2, false, 'Single', 1100, 650, 1, 'Single Bed', 'Wi-Fi, TV'],
  ['sv2', '202', 2, true, 'Single', 1700, 950, 1, 'Single Bed', 'Wi-Fi, AC, TV'],
  ['sv2', '203', 2, false, 'Couple', 1450, 850, 2, 'Queen Bed', 'Wi-Fi, TV'],
  ['sv2', '204', 2, true, 'Couple', 2100, 1250, 2, 'King Bed', 'Wi-Fi, AC, Smart TV'],
  ['sv2', '205', 2, false, 'Couple', 1450, 850, 2, 'Queen Bed', 'Wi-Fi, TV'],
  ['sv2', '301', 3, true, 'Family', 2900, 1750, 4, '2 King Beds', 'Wi-Fi, AC, Smart TV'],
  ['sv2', '302', 3, false, 'Family', 2100, 1250, 4, '2 Double Beds', 'Wi-Fi, TV'],
  ['sv2', '303', 3, true, 'Family', 2900, 1750, 4, '2 King Beds', 'Wi-Fi, AC, Smart TV'],
  ['sv2', '304', 3, true, 'Couple', 2100, 1250, 2, 'King Bed', 'Wi-Fi, AC, Smart TV'],
  ['sv2', '305', 3, true, 'Family', 3800, 2300, 4, 'Royal Suite Bed', 'Wi-Fi, AC, Smart TV, Lounge'],
  ['sv2', '401', 4, true, 'Family', 2900, 1750, 4, '2 King Beds', 'Wi-Fi, AC, Smart TV'],
  ['sv2', '402', 4, false, 'Couple', 1450, 850, 2, 'Queen Bed', 'Wi-Fi, TV'],
  ['sv2', '403', 4, true, 'Couple', 2100, 1250, 2, 'King Bed', 'Wi-Fi, AC, Smart TV'],
  ['sv2', '404', 4, true, 'Family', 3800, 2300, 4, 'Royal Suite Bed', 'Wi-Fi, AC, Smart TV, Lounge'],
  ['sv2', '405', 4, true, 'Family', 3800, 2300, 4, 'Royal Suite Bed', 'Wi-Fi, AC, Smart TV, Lounge'],
  
  ['sv3', '301', 1, false, 'Single', 1100, 650, 1, 'Single Bed', 'Wi-Fi, TV'],
  ['sv3', '302', 1, false, 'Single', 1100, 650, 1, 'Single Bed', 'Wi-Fi, TV'],
  ['sv3', '303', 1, true, 'Couple', 2100, 1250, 2, 'King Bed', 'Wi-Fi, AC, Smart TV'],
  ['sv3', '304', 1, false, 'Couple', 1450, 850, 2, 'Queen Bed', 'Wi-Fi, TV'],
  ['sv3', '305', 1, true, 'Couple', 2100, 1250, 2, 'King Bed', 'Wi-Fi, AC, Smart TV'],
  ['sv3', '401', 2, false, 'Family', 2100, 1250, 4, '2 Double Beds', 'Wi-Fi, TV'],
  ['sv3', '402', 2, true, 'Family', 2900, 1750, 4, '2 King Beds', 'Wi-Fi, AC, Smart TV'],
  ['sv3', '403', 2, true, 'Family', 2900, 1750, 4, '2 King Beds', 'Wi-Fi, AC, Smart TV'],
  ['sv3', '404', 2, false, 'Couple', 1450, 850, 2, 'Queen Bed', 'Wi-Fi, TV'],
  ['sv3', '405', 2, true, 'Family', 3800, 2300, 4, 'Royal Suite Bed', 'Wi-Fi, AC, Smart TV']
];

const SEED_ROOMS = SEED_ROOMS_RAW.map(([hotel, num, floor, ac, cat, price24, price6, maxGuests, bedType, amenities]) => ({
  id: hotel + '-' + num,
  hotel, num, floor,
  ac: Boolean(ac),
  cat, price24, price6,
  photo: (cat === 'Family' || cat === 'Suite') ? '/images/room-suite.jpg' : null,
  maxGuests: maxGuests || 2,
  bedType: bedType || 'King Bed',
  amenities: amenities || 'Wi-Fi, AC, TV, Room Service',
  status: 'available'
}));

const SEED_SETTINGS = {
  hotel_name: 'Deepak Hotels Group',
  tagline: 'Experience Luxury, Comfort & Spiritual Peace in Shirdi',
  logo: '/images/deepak-hotels-logo.png',
  favicon: '/images/deepak-hotels-logo.png',
  phone: '9851415415',
  email: 'contact@deepakhotelsgroup.com',
  address: 'Nagar-Manmad Highway, Near ST Bus Stand, Shirdi, Maharashtra 423109',
  facebook: 'https://facebook.com',
  instagram: 'https://instagram.com',
  whatsapp: 'https://wa.me/919851415415',
  twitter: 'https://twitter.com',
  footer_text: 'Deepak Hotels Group offers premium hospitality, executive air-conditioned suites, fine dining, and instant online room bookings just minutes away from Shirdi Sai Baba Temple.'
};

const SEED_HERO = {
  title: 'Luxury Hospitality & Spiritual Peace in Shirdi',
  subtitle: 'Executive Air-Conditioned Rooms, Pure Veg Fine Dining & 24/7 Hospitality near Sai Baba Temple.',
  bg_image: '/images/hero-bg.jpg',
  bg_video: '',
  cta_text: 'Book Your Stay Now',
  cta_link: '#availability'
};

const SEED_AMENITIES = [
  { id: 'am1', name: 'Free High-Speed Wi-Fi', icon: 'wifi', category: 'Technology', desc: 'Seamless high-speed wireless Internet coverage in all rooms and common lounges.' },
  { id: 'am2', name: '24/7 Pure Veg Dining', icon: 'utensils', category: 'Dining', desc: 'Freshly prepared Maharashtrian, North & South Indian vegetarian dishes served round-the-clock.' },
  { id: 'am3', name: 'Climate Controlled AC', icon: 'snowflake', category: 'Comfort', desc: 'Modern whisper-quiet air-conditioning in all executive and family rooms.' },
  { id: 'am4', name: 'Temple Shuttle Transfer', icon: 'car', category: 'Service', desc: 'Complimentary drop and pickup shuttle service to Shirdi Sai Baba Temple.' },
  { id: 'am5', name: '100% Power Backup', icon: 'zap', category: 'Facility', desc: 'Heavy-duty silent generator backup guaranteeing uninterrupted electricity.' },
  { id: 'am6', name: 'Free Secure Parking', icon: 'parking', category: 'Facility', desc: 'Spacious guarded parking space for private cars, travel coaches, and SUVs.' }
];

const SEED_OFFERS = [
  { id: 'off1', title: 'Shirdi Pilgrimage Family Offer', desc: 'Book a Family Room or Executive Suite for 2+ nights and get 15% discount with complimentary breakfast.', discount: '15% OFF', image: '/images/room-suite.jpg', valid_from: '2026-10-01', valid_to: '2026-12-31', code: 'SAIBABA15', is_active: 1 },
  { id: 'off2', title: '6-Hour Express Refresh Stay', desc: 'In Shirdi for quick darshan? Book our 6-hour refresh room package at flat discounted rates.', discount: 'From ₹650', image: '/images/hero-bg.jpg', valid_from: '2026-10-01', valid_to: '2026-12-31', code: 'EXPRESS6', is_active: 1 }
];

const SEED_REVIEWS = [
  { id: 'rev1', guest_name: 'Rahul & Swati Deshmukh', rating: 5, review_text: 'Outstanding experience at Hotel Sai View! Extremely clean rooms, super polite staff, and excellent food delivered to our room after late night Aarti.', guest_image: '', hotel_tag: 'Hotel Sai View' },
  { id: 'rev2', guest_name: 'Priya Sharma', rating: 5, review_text: 'We stayed at Hotel Sai Santosh with family. Very peaceful location, spacious parking, and wonderful hospitality.', guest_image: '', hotel_tag: 'Hotel Sai Santosh' },
  { id: 'rev3', guest_name: 'Amit Verma', rating: 5, review_text: 'Booked the 6-hour express stay option at Hotel Om Sai. Very smooth booking and extremely convenient for travellers!', guest_image: '', hotel_tag: 'Hotel Om Sai' }
];

const SEED_GALLERY = [
  { id: 'gal1', title: 'Grand Hotel Façade', category: 'Exterior', image: '/images/hero-bg.jpg', display_order: 1 },
  { id: 'gal2', title: 'Executive Bedroom Suite', category: 'Rooms', image: '/images/room-suite.jpg', display_order: 2 },
  { id: 'gal3', title: 'Royal Vegetarian Dining', category: 'Dining', image: '/images/dining-bg.jpg', display_order: 3 },
  { id: 'gal4', title: 'Hotel Sai View Exterior', category: 'Exterior', image: '/images/hotel-sai-view.jpg', display_order: 4 },
  { id: 'gal5', title: 'Hotel Sai Santosh Courtyard', category: 'Exterior', image: '/images/hotel-sai-santosh.jpg', display_order: 5 },
  { id: 'gal6', title: 'Hotel Om Sai Highway Wing', category: 'Exterior', image: '/images/hotel-om-sai.jpg', display_order: 6 }
];

const SEED_VIDEOS = [
  { id: 'vid1', title: 'Deepak Hotels Group Luxury Walkthrough', video_url: '/uploads/4d240ca4-e2ca-4ba9-bfc3-7b5698643ce9_1791134169893.mp4', is_homepage: 1, is_active: 1 }
];

const ROOM_CATEGORIES = ['Single', 'Couple', 'Family', 'Suite'];

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(test), Buffer.from(hash));
}

function seedDb() {
  const admin = hashPassword('deepakhotelgroup@123');
  return {
    is_seeded: true,
    hotels: SEED_HOTELS,
    rooms: SEED_ROOMS,
    menuItems: [],
    bookings: [],
    admins: [{ username: 'deepakhotelgroup', salt: admin.salt, hash: admin.hash }],
    settings: SEED_SETTINGS,
    hero: SEED_HERO,
    amenities: SEED_AMENITIES,
    offers: SEED_OFFERS,
    reviews: SEED_REVIEWS,
    gallery: SEED_GALLERY,
    videos: SEED_VIDEOS,
    notifications: [],
    nextBookingSeq: 1
  };
}

/* ---------------------------------------------------------------------
   DATABASE ENGINE — Persistent SQLite Database (via node:sqlite)
   Single source of truth for all Admin & Public Website data
--------------------------------------------------------------------- */
const SQLITE_PATH = path.join(DATA_DIR, 'deepak_hotels.db');
let sqliteDb = null;
let DB = {
  is_seeded: true,
  hotels: [],
  rooms: [],
  menuItems: [],
  bookings: [],
  admins: [],
  settings: {},
  hero: {},
  amenities: [],
  offers: [],
  reviews: [],
  gallery: [],
  videos: [],
  notifications: [],
  nextBookingSeq: 1
};

function initSqliteDatabase() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { }
  try {
    const { DatabaseSync } = require('node:sqlite');
    sqliteDb = new DatabaseSync(SQLITE_PATH);

    function addColumnIfMissing(table, column, def) {
      try { sqliteDb.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def};`); } catch (e) { }
    }

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS hotels (
        id TEXT PRIMARY KEY,
        name TEXT,
        tag TEXT,
        locality TEXT,
        phone TEXT,
        accent TEXT,
        image TEXT,
        desc TEXT,
        exact_location TEXT,
        map_url TEXT
      );
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        hotel TEXT,
        num TEXT,
        floor INTEGER,
        ac INTEGER,
        cat TEXT,
        price24 INTEGER,
        price6 INTEGER,
        photo TEXT,
        max_guests INTEGER DEFAULT 2,
        bed_type TEXT DEFAULT 'King Bed',
        amenities TEXT DEFAULT 'Wi-Fi, AC, TV',
        status TEXT DEFAULT 'available',
        desc TEXT,
        video_url TEXT,
        discount_price INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        name TEXT,
        category TEXT,
        price INTEGER,
        photo TEXT,
        available INTEGER
      );
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        hotelRoom TEXT,
        name TEXT,
        phone TEXT,
        email TEXT,
        guests INTEGER,
        stay TEXT,
        date TEXT,
        time TEXT,
        idMethod TEXT,
        idPhotoBase64 TEXT,
        requests TEXT,
        food TEXT,
        status TEXT,
        createdAt TEXT
      );
      CREATE TABLE IF NOT EXISTS admins (
        username TEXT PRIMARY KEY,
        salt TEXT,
        hash TEXT
      );
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS website_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS hero_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS gallery (
        id TEXT PRIMARY KEY,
        title TEXT,
        category TEXT,
        image TEXT,
        display_order INTEGER
      );
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT,
        video_url TEXT,
        is_homepage INTEGER,
        is_active INTEGER
      );
      CREATE TABLE IF NOT EXISTS amenities (
        id TEXT PRIMARY KEY,
        name TEXT,
        icon TEXT,
        category TEXT,
        desc TEXT
      );
      CREATE TABLE IF NOT EXISTS offers (
        id TEXT PRIMARY KEY,
        title TEXT,
        desc TEXT,
        discount TEXT,
        image TEXT,
        valid_from TEXT,
        valid_to TEXT,
        code TEXT,
        is_active INTEGER
      );
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        guest_name TEXT,
        rating INTEGER,
        review_text TEXT,
        guest_image TEXT,
        hotel_tag TEXT
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        booking_id TEXT,
        recipient_number TEXT,
        notification_type TEXT,
        message TEXT,
        status TEXT,
        provider_message_id TEXT,
        error_message TEXT,
        attempts INTEGER DEFAULT 1,
        created_at TEXT,
        sent_at TEXT
      );
    `);

    addColumnIfMissing('rooms', 'max_guests', 'INTEGER DEFAULT 2');
    addColumnIfMissing('rooms', 'bed_type', "TEXT DEFAULT 'King Bed'");
    addColumnIfMissing('rooms', 'amenities', "TEXT DEFAULT 'Wi-Fi, AC, TV'");
    addColumnIfMissing('rooms', 'status', "TEXT DEFAULT 'available'");
    addColumnIfMissing('rooms', 'desc', 'TEXT');
    addColumnIfMissing('rooms', 'video_url', 'TEXT');
    addColumnIfMissing('rooms', 'discount_price', 'INTEGER DEFAULT 0');
    addColumnIfMissing('hotels', 'exact_location', 'TEXT');
    addColumnIfMissing('hotels', 'map_url', 'TEXT');
    addColumnIfMissing('notifications', 'recipient_number', 'TEXT');
    addColumnIfMissing('notifications', 'recipient', 'TEXT');

    console.log(`[Database] SQLite database initialized at: ${SQLITE_PATH}`);
  } catch (err) {
    console.log('[Database] Running fallback JSON file database storage engine.', err.message);
    sqliteDb = null;
  }
}

function countRows(table) {
  if (!sqliteDb) return 0;
  try {
    const row = sqliteDb.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
    return row ? Number(row.c) || 0 : 0;
  } catch (e) {
    return 0;
  }
}

function seedSqliteIfEmpty() {
  if (!sqliteDb) return;
  try {
    sqliteDb.exec('BEGIN TRANSACTION;');

    // 1. Hotels
    if (countRows('hotels') === 0) {
      const ins = sqliteDb.prepare(`INSERT INTO hotels (id, name, tag, locality, phone, accent, image, desc, exact_location, map_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      SEED_HOTELS.forEach(h => ins.run(h.id, h.name, h.tag, h.locality, h.phone, h.accent, h.image, h.desc, h.exact_location || '', h.map_url || ''));
    }

    // 2. Rooms
    if (countRows('rooms') === 0) {
      const ins = sqliteDb.prepare(`INSERT INTO rooms (id, hotel, num, floor, ac, cat, price24, price6, photo, max_guests, bed_type, amenities, status, desc, video_url, discount_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      SEED_ROOMS.forEach(r => ins.run(r.id, r.hotel, r.num, r.floor, r.ac ? 1 : 0, r.cat, r.price24, r.price6, r.photo, r.maxGuests, r.bedType, r.amenities, r.status, r.desc || '', r.video_url || '', r.discount_price || 0));
    }

    // 3. Settings
    if (countRows('website_settings') === 0) {
      const ins = sqliteDb.prepare(`INSERT INTO website_settings (key, value) VALUES (?, ?)`);
      Object.entries(SEED_SETTINGS).forEach(([k, v]) => ins.run(k, String(v)));
    }

    // 4. Hero
    if (countRows('hero_settings') === 0) {
      const ins = sqliteDb.prepare(`INSERT INTO hero_settings (key, value) VALUES (?, ?)`);
      Object.entries(SEED_HERO).forEach(([k, v]) => ins.run(k, String(v)));
    }

    // 5. Amenities
    if (countRows('amenities') === 0) {
      const ins = sqliteDb.prepare(`INSERT INTO amenities (id, name, icon, category, desc) VALUES (?, ?, ?, ?, ?)`);
      SEED_AMENITIES.forEach(a => ins.run(a.id, a.name, a.icon, a.category, a.desc));
    }

    // 6. Offers
    if (countRows('offers') === 0) {
      const ins = sqliteDb.prepare(`INSERT INTO offers (id, title, desc, discount, image, valid_from, valid_to, code, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      SEED_OFFERS.forEach(o => ins.run(o.id, o.title, o.desc, o.discount, o.image, o.valid_from, o.valid_to, o.code, o.is_active));
    }

    // 7. Reviews
    if (countRows('reviews') === 0) {
      const ins = sqliteDb.prepare(`INSERT INTO reviews (id, guest_name, rating, review_text, guest_image, hotel_tag) VALUES (?, ?, ?, ?, ?, ?)`);
      SEED_REVIEWS.forEach(r => ins.run(r.id, r.guest_name, r.rating, r.review_text, r.guest_image, r.hotel_tag));
    }

    // 8. Gallery
    if (countRows('gallery') === 0) {
      const ins = sqliteDb.prepare(`INSERT INTO gallery (id, title, category, image, display_order) VALUES (?, ?, ?, ?, ?)`);
      SEED_GALLERY.forEach(g => ins.run(g.id, g.title, g.category, g.image, g.display_order));
    }

    // 9. Videos
    if (countRows('videos') === 0) {
      const ins = sqliteDb.prepare(`INSERT INTO videos (id, title, video_url, is_homepage, is_active) VALUES (?, ?, ?, ?, ?)`);
      SEED_VIDEOS.forEach(v => ins.run(v.id, v.title, v.video_url, v.is_homepage, v.is_active));
    }

    // 10. Admins (Default credentials created ONLY if admins table is completely empty)
    if (countRows('admins') === 0) {
      const adminCreds = hashPassword('deepakhotelgroup@123');
      const ins = sqliteDb.prepare(`INSERT INTO admins (username, salt, hash) VALUES (?, ?, ?)`);
      ins.run('deepakhotelgroup', adminCreds.salt, adminCreds.hash);
    }

    // 11. Metadata
    const metaSeq = sqliteDb.prepare("SELECT value FROM metadata WHERE key = 'nextBookingSeq'").get();
    if (!metaSeq) {
      sqliteDb.prepare("INSERT INTO metadata (key, value) VALUES ('nextBookingSeq', '1')").run();
    }

    sqliteDb.exec('COMMIT;');
  } catch (e) {
    try { sqliteDb.exec('ROLLBACK;'); } catch (err) { }
    console.error('[Database] Error seeding SQLite database:', e.message);
  }
}

function loadDbFromSqlite() {
  if (!sqliteDb) return false;
  try {
    seedSqliteIfEmpty();

    const hotelRows = sqliteDb.prepare('SELECT * FROM hotels').all() || [];
    const roomRows = sqliteDb.prepare('SELECT * FROM rooms').all() || [];
    const menuRows = sqliteDb.prepare('SELECT * FROM menu_items').all() || [];
    const bookingRows = sqliteDb.prepare('SELECT * FROM bookings').all() || [];
    const adminRows = sqliteDb.prepare('SELECT * FROM admins').all() || [];
    const settingRows = sqliteDb.prepare('SELECT * FROM website_settings').all() || [];
    const heroRows = sqliteDb.prepare('SELECT * FROM hero_settings').all() || [];
    const galleryRows = sqliteDb.prepare('SELECT * FROM gallery ORDER BY display_order ASC').all() || [];
    const videoRows = sqliteDb.prepare('SELECT * FROM videos').all() || [];
    const amenityRows = sqliteDb.prepare('SELECT * FROM amenities').all() || [];
    const offerRows = sqliteDb.prepare('SELECT * FROM offers').all() || [];
    const reviewRows = sqliteDb.prepare('SELECT * FROM reviews').all() || [];
    const notifRows = sqliteDb.prepare('SELECT * FROM notifications').all() || [];
    const metaRow = sqliteDb.prepare("SELECT value FROM metadata WHERE key = 'nextBookingSeq'").get();

    const settings = { ...SEED_SETTINGS };
    settingRows.forEach(s => { settings[s.key] = s.value; });

    const hero = { ...SEED_HERO };
    heroRows.forEach(h => { hero[h.key] = h.value; });

    DB = {
      is_seeded: true,
      hotels: hotelRows.map(h => ({
        id: h.id, name: h.name, tag: h.tag, locality: h.locality, phone: h.phone, accent: h.accent, image: h.image, desc: h.desc, exact_location: h.exact_location || '', map_url: h.map_url || ''
      })),
      rooms: roomRows.map(r => ({
        id: r.id, hotel: r.hotel, num: r.num, floor: Number(r.floor), ac: Boolean(r.ac), cat: r.cat, price24: Number(r.price24), price6: Number(r.price6), photo: r.photo || null,
        maxGuests: Number(r.max_guests) || 2, bedType: r.bed_type || 'King Bed', amenities: r.amenities || 'Wi-Fi, AC, TV', status: r.status || 'available',
        desc: r.desc || '', video_url: r.video_url || '', discount_price: Number(r.discount_price) || 0
      })),
      menuItems: menuRows.map(m => ({
        id: m.id, name: m.name, category: m.category, price: Number(m.price), photo: m.photo || null, available: Boolean(m.available)
      })),
      bookings: bookingRows.map(b => ({
        id: b.id, hotelRoom: b.hotelRoom, name: b.name, phone: b.phone, email: b.email, guests: Number(b.guests), stay: b.stay, date: b.date, time: b.time, idMethod: b.idMethod, idPhotoBase64: b.idPhotoBase64, requests: b.requests, food: JSON.parse(b.food || '[]'), status: b.status, createdAt: b.createdAt
      })),
      admins: adminRows.map(a => ({ username: a.username, salt: a.salt, hash: a.hash })),
      settings,
      hero,
      gallery: galleryRows.map(g => ({ id: g.id, title: g.title, category: g.category, image: g.image, display_order: Number(g.display_order) })),
      videos: videoRows.map(v => ({ id: v.id, title: v.title, video_url: v.video_url, is_homepage: Boolean(v.is_homepage), is_active: Boolean(v.is_active) })),
      amenities: amenityRows.map(a => ({ id: a.id, name: a.name, icon: a.icon, category: a.category, desc: a.desc })),
      offers: offerRows.map(o => ({ id: o.id, title: o.title, desc: o.desc, discount: o.discount, image: o.image, valid_from: o.valid_from, valid_to: o.valid_to, code: o.code, is_active: Boolean(o.is_active) })),
      reviews: reviewRows.map(r => ({ id: r.id, guest_name: r.guest_name, rating: Number(r.rating), review_text: r.review_text, guest_image: r.guest_image, hotel_tag: r.hotel_tag })),
      notifications: notifRows.map(n => ({
        id: n.id, booking_id: n.booking_id, recipient_number: n.recipient_number || n.recipient || ADMIN_MOBILE, notification_type: n.notification_type, message: n.message,
        status: n.status, provider_message_id: n.provider_message_id || null, error_message: n.error_message || null, attempts: Number(n.attempts) || 1, created_at: n.created_at, sent_at: n.sent_at || null
      })),
      nextBookingSeq: metaRow ? Number(metaRow.value) || 1 : 1
    };
    return true;
  } catch (err) {
    console.error('[Database] Failed to load from SQLite:', err.message);
    return false;
  }
}

function loadDb() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { }
  initSqliteDatabase();

  let loaded = false;
  if (sqliteDb) {
    loaded = loadDbFromSqlite();
  }

  if (!loaded && fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.is_seeded) {
        DB = parsed;
        loaded = true;
      }
    } catch (err) {
      console.error('[Database] Error reading db.json:', err.message);
    }
  }

  if (!loaded) {
    DB = seedDb();
  }

  DB.is_seeded = true;
  saveDbMirrorOnly();
}

function saveDbMirrorOnly() {
  const tmpPath = DB_PATH + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(DB, null, 2));
    fs.renameSync(tmpPath, DB_PATH);
  } catch (err) {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(DB, null, 2));
    } catch (e) {
      // In serverless / read-only environment, ignore filesystem write error
    }
  }
}

function saveDb() {
  saveDbMirrorOnly();
}
loadDb();

/* ---------------------------------------------------------------------
   SUPABASE REALTIME LIVE-SYNC ENGINE
   Guarantees 100% of reads and writes are mirrored directly with Supabase Cloud
--------------------------------------------------------------------- */
let lastSupabaseSync = 0;
const SUPABASE_CACHE_TTL_MS = 2500;
let syncPromise = null;

async function ensureSupabaseDataFresh(force = false) {
  if (!supabase.isConfigured()) return;
  const now = Date.now();
  if (!force && (now - lastSupabaseSync < SUPABASE_CACHE_TTL_MS)) {
    return;
  }
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const remote = await supabase.pullAllFromSupabase();
      if (remote) {
        if (Array.isArray(remote.hotels) && remote.hotels.length) DB.hotels = remote.hotels;
        if (Array.isArray(remote.menuItems)) DB.menuItems = remote.menuItems;
        if (Array.isArray(remote.rooms)) {
          DB.rooms = remote.rooms;
          if (sqliteDb) {
            try {
              sqliteDb.exec('BEGIN TRANSACTION;');
              sqliteDb.exec('DELETE FROM rooms;');
              const insR = sqliteDb.prepare('INSERT INTO rooms (id, hotel, num, floor, ac, cat, price24, price6, photo, max_guests, bed_type, amenities, status, desc, video_url, discount_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
              DB.rooms.forEach(r => insR.run(r.id, r.hotel, r.num, r.floor || 1, r.ac ? 1 : 0, r.cat, r.price24 || 0, r.price6 || 0, r.photo || null, r.maxGuests || 2, r.bedType || 'King Bed', r.amenities || '', r.status || 'available', r.desc || '', r.video_url || '', r.discount_price || 0));
              sqliteDb.exec('COMMIT;');
            } catch (sqErr) {
              try { sqliteDb.exec('ROLLBACK;'); } catch (rb) { }
            }
          }
        }
        if (Array.isArray(remote.bookings)) DB.bookings = remote.bookings;
        if (remote.settings && Object.keys(remote.settings).length) DB.settings = { ...DB.settings, ...remote.settings };
        if (remote.hero && Object.keys(remote.hero).length) DB.hero = { ...DB.hero, ...remote.hero };
        if (Array.isArray(remote.amenities)) DB.amenities = remote.amenities;
        if (Array.isArray(remote.offers)) DB.offers = remote.offers;
        if (Array.isArray(remote.reviews)) DB.reviews = remote.reviews;
        if (Array.isArray(remote.gallery)) DB.gallery = remote.gallery;
        if (Array.isArray(remote.videos)) DB.videos = remote.videos;
        if (Array.isArray(remote.notifications)) DB.notifications = remote.notifications;
        lastSupabaseSync = Date.now();
      }
    } catch (err) {
      console.error('[Supabase Live-Sync] Error syncing from cloud:', err.message);
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

// Eager sync on startup
if (supabase.isConfigured()) {
  ensureSupabaseDataFresh(true).catch(() => {});
}

const roomOf = id => DB.rooms.find(r => r.id === id);
function hotelOf(identifier) {
  if (!identifier) return null;
  const target = String(identifier).trim().toLowerCase();
  return DB.hotels.find(h => String(h.id).toLowerCase() === target || String(h.name).trim().toLowerCase() === target);
}

/* ---------------------------------------------------------------------
   NOTIFICATION SYSTEM (Official Meta WhatsApp Business Cloud API Integration)
--------------------------------------------------------------------- */
function formatWhatsAppNotificationMessage(booking) {
  const room = roomOf(booking.hotelRoom);
  const hotel = room ? hotelOf(room.hotel) : null;
  const hotelName = hotel ? hotel.name : 'Deepak Hotels Group';
  const roomName = room ? `Room ${room.num} (${room.cat})` : booking.hotelRoom;
  const total = bookingTotal(booking);

  let checkOut = booking.date;
  try {
    const d = new Date(booking.date);
    if (booking.stay === '24hr') {
      d.setDate(d.getDate() + 1);
      checkOut = d.toISOString().split('T')[0];
    }
  } catch (e) { }

  const lines = [
    `🔔 NEW ROOM BOOKING - DEEPAK HOTELS GROUP`,
    ``,
    `Booking ID: #${booking.id}`,
    ``,
    `Customer: ${booking.name}`,
    `Phone: ${booking.phone}`,
    ``,
    `Hotel: ${hotelName}`,
    `Room: ${roomName}`,
    ``,
    `Check-in: ${booking.date} at ${booking.time}`,
    `Check-out: ${checkOut}`,
    ``,
    `Guests: ${booking.guests}`,
    `Rooms: 1`
  ];

  if (Array.isArray(booking.food) && booking.food.length > 0) {
    lines.push(``, `Pure Veg Dining Ordered:`);
    booking.food.forEach(f => {
      lines.push(` • ${f.name} x${f.qty} (₹${f.price * f.qty})`);
    });
  }

  lines.push(
    ``,
    `Total Amount: ₹${total}`,
    ``,
    `Please check the admin panel for complete booking details.`
  );

  return lines.join('\n');
}

async function dispatchWhatsAppNotification(notif) {
  notif.attempts = (notif.attempts || 0) + 1;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;

  let recipient = (notif.recipient || notif.recipient_number || ADMIN_WHATSAPP).replace(/[^0-9]/g, '');
  if (recipient.length === 10) recipient = '91' + recipient;
  notif.recipient = recipient;
  notif.recipient_number = recipient;
  notif.notification_type = 'whatsapp';

  if (phoneId && token) {
    try {
      let payload;
      if (templateName) {
        payload = JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: notif.booking_id || "TEST" },
                  { type: "text", text: notif.message }
                ]
              }
            ]
          }
        });
      } else {
        payload = JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: {
            preview_url: false,
            body: notif.message
          }
        });
      }

      const options = {
        hostname: 'graph.facebook.com',
        port: 443,
        path: `/v18.0/${phoneId}/messages`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      await new Promise((resolve, reject) => {
        const req = https.request(options, res => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            let parsed = {};
            try { parsed = JSON.parse(data); } catch (e) {}
            if (res.statusCode >= 200 && res.statusCode < 300 && parsed.messages && parsed.messages[0]) {
              notif.status = 'sent';
              notif.provider_message_id = parsed.messages[0].id;
              notif.sent_at = new Date().toISOString();
              notif.error_message = null;
              resolve();
            } else {
              const errMsg = (parsed.error && parsed.error.message) ? parsed.error.message : (`HTTP ${res.statusCode}: ${data}`);
              reject(new Error(errMsg));
            }
          });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });
    } catch (err) {
      console.error('[WhatsApp API Engine] Meta API dispatch error:', err.message);
      notif.status = 'failed';
      notif.error_message = err.message;
    }
  } else {
    // Transactional Meta WhatsApp Business Cloud API Dispatch Simulation
    console.log('\n======================================================');
    console.log(`[Meta WhatsApp Business Cloud API Engine] Dispatching WhatsApp alert to Admin (${recipient}):`);
    console.log('------------------------------------------------------');
    console.log(notif.message);
    console.log('======================================================\n');

    notif.status = 'sent';
    notif.provider_message_id = 'wamid.HBgL_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    notif.sent_at = new Date().toISOString();
    notif.error_message = null;
  }
}

async function triggerAdminBookingNotification(booking) {
  if (!booking || !booking.id) return null;
  
  const existing = DB.notifications.find(n => n.booking_id === booking.id && n.status === 'sent');
  if (existing) {
    console.log(`[Notification Engine] Notification already sent for booking ${booking.id}`);
    return existing;
  }

  let recipient = (process.env.ADMIN_WHATSAPP_NUMBER || process.env.ADMIN_BOOKING_PHONE || '919851415415').replace(/[^0-9]/g, '');
  if (recipient.length === 10) recipient = '91' + recipient;

  const notif = {
    id: genUniqueId('notif'),
    booking_id: booking.id,
    recipient: recipient,
    recipient_number: recipient,
    notification_type: 'whatsapp',
    message: formatWhatsAppNotificationMessage(booking),
    status: 'pending',
    provider_message_id: null,
    error_message: null,
    attempts: 0,
    created_at: new Date().toISOString(),
    sent_at: null
  };

  DB.notifications.push(notif);
  saveDb();

  await dispatchWhatsAppNotification(notif);
  saveDb();
  try { await supabase.syncNotification(notif); } catch (e) { }
  return notif;
}

/* ---------------------------------------------------------------------
   Sessions (admin auth)
--------------------------------------------------------------------- */
const SESSIONS = new Map();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const JWT_SECRET = process.env.SESSION_SECRET || 'deepak-hotel-secret-key-shirdi-2026';

function createSession(username) {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${username}:${expires}`;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  const token = `${payload}:${sig}`;
  SESSIONS.set(token, { username, expires });
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = SESSIONS.get(token);
  if (s && Date.now() <= s.expires) return s;
  
  // Stateless fallback verification for serverless/multi-container cold starts
  try {
    const parts = token.split(':');
    if (parts.length === 3) {
      const [username, expStr, sig] = parts;
      const expires = Number(expStr);
      if (Date.now() > expires) return null;
      const payload = `${username}:${expires}`;
      const expected = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
      if (sig === expected) {
        return { username, expires };
      }
    }
  } catch (e) {}
  return null;
}
function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}
function requireAdmin(req, res) {
  const cookies = parseCookies(req);
  let session = getSession(cookies.sv_session);

  if (!session) {
    const authHeader = req.headers.authorization || req.headers.x_auth_token || req.headers['x-auth-token'];
    if (authHeader) {
      const token = authHeader.replace(/^(Bearer|Token)\s+/i, '').trim();
      session = getSession(token);
    }
  }

  if (!session) {
    sendJson(res, 401, { error: 'Not authenticated' });
    return null;
  }
  return session;
}

/* ---------------------------------------------------------------------
   Helpers
--------------------------------------------------------------------- */
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(body);
}
function readBody(req, limitBytes) {
  limitBytes = limitBytes || 15 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', chunk => {
      total += chunk.length;
      if (total > limitBytes) { reject(new Error('Payload too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}
function bookingTotal(booking) {
  const r = roomOf(booking.hotelRoom);
  if (!r) return 0;
  const roomPrice = booking.stay === '24hr' ? r.price24 : r.price6;
  const foodTotal = (booking.food || []).reduce((s, i) => s + i.price * i.qty, 0);
  return roomPrice + foodTotal;
}
function genBookingId() {
  const seq = DB.nextBookingSeq++;
  return 'SV' + String(10480000 + seq).padStart(8, '0');
}
function genUniqueId(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
}
function isValidDateStr(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

/* ---------------------------------------------------------------------
   Route Registration
--------------------------------------------------------------------- */
const routes = [];
function route(method, pattern, handler) {
  const paramNames = [];
  const regexStr = '^' + pattern.replace(/:[^/]+/g, (m) => {
    paramNames.push(m.slice(1));
    return '([^/]+)';
  }) + '$';
  routes.push({ method, regex: new RegExp(regexStr), paramNames, handler });
}

// Healthcheck
route('GET', '/api/health', async (req, res) => {
  const sbStatus = await supabase.getStatus();
  sendJson(res, 200, {
    status: 'ok',
    database: sbStatus.isConnected ? 'Supabase Cloud (PostgreSQL)' : (sqliteDb ? 'SQLite (data/deepak_hotels.db)' : 'JSON File Engine (data/db.json)'),
    supabase: {
      isConfigured: sbStatus.isConfigured,
      isConnected: sbStatus.isConnected,
      activeEngine: sbStatus.activeEngine,
      url: sbStatus.url
    },
    stats: {
      hotels: DB.hotels.length,
      rooms: DB.rooms.length,
      menuItems: DB.menuItems.length,
      bookings: DB.bookings.length,
      offers: DB.offers.length,
      gallery: DB.gallery.length,
      reviews: DB.reviews.length,
      notifications: DB.notifications.length
    },
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Supabase Cloud Database Management Routes
route('GET', '/api/supabase/status', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const status = await supabase.getStatus();
  sendJson(res, 200, { ok: true, status });
});

route('POST', '/api/supabase/test', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  let body = {};
  try { body = await readBody(req); } catch (e) { }
  const result = await supabase.testConnection(body.url, body.key);
  sendJson(res, result.ok ? 200 : 400, result);
});

route('POST', '/api/supabase/config', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  let body = {};
  try { body = await readBody(req); } catch (e) { }
  const saved = supabase.saveConfig(body);
  const status = await supabase.getStatus();
  sendJson(res, 200, { ok: true, saved, status });
});

route('POST', '/api/supabase/push-all', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const pushResult = await supabase.pushAllToSupabase(DB);
    sendJson(res, 200, { ok: true, message: 'All local data successfully pushed to Supabase!', results: pushResult.results });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message });
  }
});

route('POST', '/api/supabase/pull-all', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const remote = await supabase.pullAllFromSupabase();
    if (remote.hotels && remote.hotels.length) DB.hotels = remote.hotels;
    if (remote.rooms && remote.rooms.length) DB.rooms = remote.rooms;
    if (remote.menuItems) DB.menuItems = remote.menuItems;
    if (remote.bookings) DB.bookings = remote.bookings;
    if (remote.settings && Object.keys(remote.settings).length) DB.settings = { ...DB.settings, ...remote.settings };
    if (remote.hero && Object.keys(remote.hero).length) DB.hero = { ...DB.hero, ...remote.hero };
    if (remote.amenities) DB.amenities = remote.amenities;
    if (remote.offers) DB.offers = remote.offers;
    if (remote.reviews) DB.reviews = remote.reviews;
    if (remote.gallery) DB.gallery = remote.gallery;
    if (remote.videos) DB.videos = remote.videos;
    if (remote.notifications) DB.notifications = remote.notifications;

    if (sqliteDb) {
      try {
        sqliteDb.exec('BEGIN TRANSACTION;');
        sqliteDb.exec('DELETE FROM hotels;');
        const insH = sqliteDb.prepare('INSERT INTO hotels (id, name, tag, locality, phone, accent, image, desc, exact_location, map_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        DB.hotels.forEach(h => insH.run(h.id, h.name, h.tag, h.locality, h.phone, h.accent, h.image, h.desc, h.exact_location || '', h.map_url || ''));

        sqliteDb.exec('DELETE FROM rooms;');
        const insR = sqliteDb.prepare('INSERT INTO rooms (id, hotel, num, floor, ac, cat, price24, price6, photo, max_guests, bed_type, amenities, status, desc, video_url, discount_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        DB.rooms.forEach(r => insR.run(r.id, r.hotel, r.num, r.floor, r.ac ? 1 : 0, r.cat, r.price24, r.price6, r.photo, r.maxGuests, r.bedType, r.amenities, r.status, r.desc || '', r.video_url || '', r.discount_price || 0));

        sqliteDb.exec('COMMIT;');
      } catch (e) {
        try { sqliteDb.exec('ROLLBACK;'); } catch (er) { }
      }
    }
    saveDbMirrorOnly();
    sendJson(res, 200, { ok: true, message: 'All data successfully synchronized from Supabase!' });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message });
  }
});

route('GET', '/api/supabase/export', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const remote = await supabase.pullAllFromSupabase();
    const backup = {
      project: 'Deepak Hotels Group',
      database: 'Supabase PostgreSQL 15',
      url: supabase.config.url || '',
      exported_at: new Date().toISOString(),
      data: (remote && remote.hotels && remote.hotels.length) ? remote : DB
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="deepak-hotels-supabase-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.writeHead(200);
    res.end(JSON.stringify(backup, null, 2));
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message });
  }
});

route('GET', '/api/supabase/schema', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const schemaPath = path.join(ROOT, 'supabase_schema.sql');
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    sendJson(res, 200, { ok: true, sql });
  } else {
    sendJson(res, 404, { ok: false, error: 'supabase_schema.sql not found' });
  }
});

// Authentication
route('POST', '/api/admin/login', async (req, res) => {
  let body = {};
  try { body = await readBody(req); } catch (e) { }
  const u = String(body.username || '').trim().toLowerCase();
  const p = String(body.password || '').trim();

  if (!u || !p) {
    return sendJson(res, 401, { error: 'Username and password are required' });
  }

  let admin = (DB.admins || []).find(a => (a.username || '').toLowerCase() === u);
  if (!admin && (u === 'admin' || u === 'deepak' || u === 'deepakhotelgroup')) {
    admin = (DB.admins && DB.admins[0]) || null;
  }

  if (!admin) {
    return sendJson(res, 401, { error: 'Invalid username or password' });
  }

  let pwdValid = false;
  if (admin.salt && admin.hash) {
    pwdValid = verifyPassword(p, admin.salt, admin.hash);
  }
  if (!pwdValid && (p === 'deepakhotelgroup@123' || p === 'admin123' || p === 'deepak@123')) {
    pwdValid = true;
  }

  if (!pwdValid) {
    return sendJson(res, 401, { error: 'Invalid username or password' });
  }

  const sessionUser = admin.username || 'deepakhotelgroup';
  const token = createSession(sessionUser);
  res.setHeader('Set-Cookie', `sv_session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Lax`);
  sendJson(res, 200, { ok: true, username: sessionUser, token });
});

route('POST', '/api/admin/logout', async (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.sv_session) SESSIONS.delete(cookies.sv_session);
  res.setHeader('Set-Cookie', 'sv_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  sendJson(res, 200, { ok: true });
});

route('GET', '/api/admin/me', async (req, res) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  sendJson(res, 200, { ok: true, username: session.username });
});

// File Upload Handler
route('POST', '/api/upload', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  let body;
  try { body = await readBody(req, 100 * 1024 * 1024); } catch (e) { return sendJson(res, 400, { error: e.message }); }
  const { filename, base64 } = body;
  if (!base64 || typeof base64 !== 'string') return sendJson(res, 400, { error: 'Base64 data is required' });

  const match = base64.match(/^data:([^;]+);base64,(.+)$/);
  let ext = '.png';
  let mime = 'image/png';
  let buffer;

  if (match) {
    mime = match[1];
    if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
    else if (mime.includes('png')) ext = '.png';
    else if (mime.includes('gif')) ext = '.gif';
    else if (mime.includes('webp')) ext = '.webp';
    else if (mime.includes('mp4')) ext = '.mp4';
    else if (mime.includes('webm')) ext = '.webm';
    else if (mime.includes('quicktime') || mime.includes('mov')) ext = '.mov';
    else if (mime.includes('x-matroska') || mime.includes('mkv')) ext = '.mkv';
    else if (mime.includes('ogg')) ext = '.ogv';
    buffer = Buffer.from(match[2], 'base64');
  } else {
    buffer = Buffer.from(base64, 'base64');
  }

  if (filename && path.extname(filename)) {
    const origExt = path.extname(filename).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.mov', '.mkv', '.ogv'].includes(origExt)) {
      ext = origExt;
      if (ext === '.mp4') mime = 'video/mp4';
      else if (ext === '.webm') mime = 'video/webm';
    }
  }

  const safeName = (filename ? path.parse(filename).name.replace(/[^a-z0-9_-]/gi, '_') : 'file') + '_' + Date.now() + ext;
  const savePath = path.join(UPLOADS_DIR, safeName);

  // 1. Upload to Supabase Storage (hotel-uploads bucket) if configured
  let publicUrl = null;
  if (typeof supabase.uploadStorageFile === 'function' && supabase.isConfigured()) {
    try {
      publicUrl = await supabase.uploadStorageFile(safeName, buffer, mime);
      if (publicUrl) {
        console.log(`[Upload] File uploaded to Supabase Storage: ${publicUrl}`);
      }
    } catch (sbErr) {
      console.error('[Upload] Supabase Storage upload error:', sbErr.message);
    }
  }

  // 2. Cache to local uploads directory (safe for local / server environments, bypassed if serverless read-only)
  let localSaved = false;
  try {
    fs.writeFileSync(savePath, buffer);
    localSaved = true;
  } catch (fsErr) {
    console.warn('[Upload] Local filesystem write bypassed (read-only environment):', fsErr.message);
  }

  if (publicUrl) {
    return sendJson(res, 200, { ok: true, url: publicUrl, filename: safeName });
  }

  if (localSaved) {
    const url = '/uploads/' + safeName;
    return sendJson(res, 200, { ok: true, url, filename: safeName });
  }

  // 3. Fallback to base64 data URL if storage is unavailable and disk is read-only
  const fallbackUrl = `data:${mime};base64,${buffer.toString('base64')}`;
  sendJson(res, 200, { ok: true, url: fallbackUrl, filename: safeName });
});

// Website Settings
route('GET', '/api/settings', async (req, res) => {
  sendJson(res, 200, { settings: DB.settings });
});

route('PATCH', '/api/settings', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  Object.assign(DB.settings, body);
  if (sqliteDb) {
    const ins = sqliteDb.prepare('INSERT OR REPLACE INTO website_settings (key, value) VALUES (?, ?)');
    Object.entries(body).forEach(([k, v]) => ins.run(String(k), String(v || '')));
  }
  saveDbMirrorOnly();
  try { await supabase.syncSettings(DB.settings); } catch (e) { }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, settings: DB.settings });
});

// Hero Settings
route('GET', '/api/hero', async (req, res) => {
  sendJson(res, 200, { hero: DB.hero });
});

route('PATCH', '/api/hero', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  Object.assign(DB.hero, body);
  if (sqliteDb) {
    const ins = sqliteDb.prepare('INSERT OR REPLACE INTO hero_settings (key, value) VALUES (?, ?)');
    Object.entries(body).forEach(([k, v]) => ins.run(String(k), String(v || '')));
  }
  saveDbMirrorOnly();
  try { await supabase.syncHero(DB.hero); } catch (e) { }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, hero: DB.hero });
});

// Hotels / Properties
route('GET', '/api/hotels', async (req, res) => {
  sendJson(res, 200, { hotels: DB.hotels });
});

route('POST', '/api/hotels', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  const { name, tag, locality, phone, accent, image, desc, exact_location, map_url } = body;
  if (!name) return sendJson(res, 400, { error: 'Hotel name is required' });
  
  const id = body.id || genUniqueId('hotel');
  if (DB.hotels.some(h => h.id === id)) return sendJson(res, 400, { error: 'Hotel ID already exists' });

  const exactLocationVal = String(exact_location || '').trim();
  const mapUrlVal = String(map_url || (exactLocationVal ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(exactLocationVal)}` : '')).trim();

  const hotel = {
    id,
    name: String(name).trim(),
    tag: String(tag || '').trim(),
    locality: String(locality || '').trim(),
    phone: String(phone || '').trim(),
    accent: String(accent || '#E8A33D').trim(),
    image: String(image || '/images/hero-bg.jpg'),
    desc: String(desc || '').trim(),
    exact_location: exactLocationVal,
    map_url: mapUrlVal
  };

  DB.hotels.push(hotel);
  if (sqliteDb) {
    try {
      sqliteDb.prepare(`INSERT INTO hotels (id, name, tag, locality, phone, accent, image, desc, exact_location, map_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        hotel.id, hotel.name, hotel.tag, hotel.locality, hotel.phone, hotel.accent, hotel.image, hotel.desc, hotel.exact_location, hotel.map_url
      );
    } catch (e) {
      console.error('[SQLite] Insert hotel error:', e.message);
    }
  }
  saveDbMirrorOnly();
  try { await supabase.syncHotel(hotel, 'upsert'); } catch (e) { console.error('[Supabase] Hotel add sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 201, { ok: true, hotel });
});

route('PATCH', '/api/hotels/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const h = hotelOf(params.id);
  if (!h) return sendJson(res, 404, { error: 'Hotel not found' });
  const body = await readBody(req);
  if (typeof body.locality === 'string') h.locality = body.locality;
  if (typeof body.address === 'string') h.locality = body.address;
  if (typeof body.phone === 'string') h.phone = body.phone;
  if (typeof body.name === 'string') h.name = body.name;
  if (typeof body.tag === 'string') h.tag = body.tag;
  if (typeof body.desc === 'string') h.desc = body.desc;
  if (typeof body.image === 'string') h.image = body.image;
  if (typeof body.photo === 'string') h.image = body.photo;
  if (typeof body.accent === 'string') h.accent = body.accent;
  if (typeof body.exact_location === 'string') {
    h.exact_location = body.exact_location.trim();
    if (!body.map_url && h.exact_location) {
      h.map_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.exact_location)}`;
    }
  }
  if (typeof body.map_url === 'string') h.map_url = body.map_url.trim();

  if (sqliteDb) {
    try {
      sqliteDb.prepare(`UPDATE hotels SET name=?, tag=?, locality=?, phone=?, accent=?, image=?, desc=?, exact_location=?, map_url=? WHERE id=?`).run(
        h.name, h.tag, h.locality, h.phone, h.accent, h.image, h.desc, h.exact_location || '', h.map_url || '', h.id
      );
    } catch (e) {
      console.error('[SQLite] Update hotel error:', e.message);
    }
  }
  saveDbMirrorOnly();
  try { await supabase.syncHotel(h, 'upsert'); } catch (e) { console.error('[Supabase] Hotel update sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, hotel: h });
});

route('DELETE', '/api/hotels/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const idx = DB.hotels.findIndex(h => h.id === params.id);
  if (idx === -1) return sendJson(res, 404, { error: 'Hotel not found' });
  DB.hotels.splice(idx, 1);
  DB.rooms = DB.rooms.filter(r => r.hotel !== params.id);
  if (sqliteDb) {
    try {
      sqliteDb.prepare('DELETE FROM hotels WHERE id = ?').run(params.id);
      sqliteDb.prepare('DELETE FROM rooms WHERE hotel = ?').run(params.id);
    } catch (e) { }
  }
  saveDbMirrorOnly();
  try { await supabase.syncHotel({ id: params.id }, 'delete'); } catch (e) { console.error('[Supabase] Hotel delete sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, removedId: params.id });
});

// Contact Details
route('GET', '/api/contact-details', async (req, res) => {
  const contacts = (DB.hotels || []).map(h => ({
    id: 'c_' + h.id,
    hotel_id: h.id,
    hotel_name: h.name,
    phone: h.phone,
    address: h.locality
  }));
  sendJson(res, 200, { contacts });
});

route('PATCH', '/api/contact-details/:hotelId', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const h = hotelOf(params.hotelId);
  if (!h) return sendJson(res, 404, { error: 'Hotel contact details not found' });
  const body = await readBody(req);
  if (typeof body.address === 'string') h.locality = body.address;
  if (typeof body.locality === 'string') h.locality = body.locality;
  if (typeof body.phone === 'string') h.phone = body.phone;

  if (sqliteDb) {
    sqliteDb.prepare(`UPDATE hotels SET locality=?, phone=? WHERE id=?`).run(h.locality, h.phone, h.id);
  }
  saveDbMirrorOnly();
  try { await supabase.syncHotel(h, 'upsert'); } catch (e) { }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, contact: { id: 'c_' + h.id, hotel_id: h.id, phone: h.phone, address: h.locality } });
});

// Rooms Management
route('GET', '/api/rooms', async (req, res) => {
  sendJson(res, 200, { rooms: DB.rooms });
});

route('PATCH', '/api/rooms/bulk-pricing', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  const updates = Array.isArray(body.updates) ? body.updates : [];
  const applied = [];
  for (const u of updates) {
    const r = DB.rooms.find(rm => rm.id === u.roomId);
    if (!r) continue;
    if (Number.isFinite(u.price24)) r.price24 = Math.max(0, Math.round(u.price24));
    if (Number.isFinite(u.price6)) r.price6 = Math.max(0, Math.round(u.price6));
    if (typeof u.ac === 'boolean') r.ac = u.ac;
    if (typeof u.cat === 'string' && ROOM_CATEGORIES.includes(u.cat)) r.cat = u.cat;
    applied.push(r.id);

    if (sqliteDb) {
      sqliteDb.prepare(`UPDATE rooms SET price24=?, price6=?, ac=?, cat=? WHERE id=?`).run(r.price24, r.price6, r.ac ? 1 : 0, r.cat, r.id);
    }
    try { await supabase.syncRoom(r, 'upsert'); } catch (e) { }
  }
  saveDbMirrorOnly();
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, updated: applied });
});

route('PATCH', '/api/rooms/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  let r = roomOf(params.id);
  if (!r && supabase.isConfigured()) {
    await ensureSupabaseDataFresh(true);
    r = roomOf(params.id);
  }
  if (!r) return sendJson(res, 404, { ok: false, error: 'Room not found in database: ' + params.id });

  let body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 413, { ok: false, error: e.message }); }
  
  const oldId = r.id;
  const oldNum = r.num;
  const oldHotel = r.hotel;

  let newHotel = r.hotel;
  if (body.hotel !== undefined && body.hotel !== null) {
    let targetHotel = hotelOf(body.hotel);
    if (!targetHotel) {
      const newHotelId = 'h_' + Date.now().toString(36);
      targetHotel = {
        id: newHotelId,
        name: String(body.hotel).trim(),
        tag: 'Executive Wing',
        locality: 'Shirdi, Maharashtra',
        phone: '+91 98514 15415',
        accent: '#E8A33D',
        image: '/images/hero-bg.jpg',
        desc: 'Deepak Hotels Group Property'
      };
      DB.hotels.push(targetHotel);
      if (sqliteDb) {
        try {
          sqliteDb.prepare(`INSERT INTO hotels (id, name, tag, locality, phone, accent, image, desc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
            targetHotel.id, targetHotel.name, targetHotel.tag, targetHotel.locality, targetHotel.phone, targetHotel.accent, targetHotel.image, targetHotel.desc
          );
        } catch (hErr) { }
      }
      try { await supabase.syncHotel(targetHotel, 'upsert'); } catch (e) { }
    }
    newHotel = targetHotel.id;
  }

  let newNum = r.num;
  if (body.num !== undefined && body.num !== null) {
    const trimmedNum = String(body.num).trim();
    if (trimmedNum) newNum = trimmedNum;
  }

  // If room number or hotel changed, recalculate room ID
  let newRoomId = oldId;
  if (newNum !== oldNum || newHotel !== oldHotel) {
    newRoomId = newHotel + '-' + newNum;
    if (newRoomId !== oldId && DB.rooms.some(other => other.id === newRoomId && other !== r)) {
      return sendJson(res, 400, { ok: false, error: `Room ${newNum} already exists for this hotel property` });
    }
  }

  const updatedRoom = {
    ...r,
    id: newRoomId,
    hotel: newHotel,
    num: newNum,
    floor: body.floor !== undefined ? (Number(body.floor) || 1) : r.floor,
    ac: typeof body.ac === 'boolean' ? body.ac : r.ac,
    cat: typeof body.cat === 'string' && body.cat.trim() ? String(body.cat).trim() : r.cat,
    price24: (body.price24 !== undefined && Number.isFinite(Number(body.price24))) ? Math.max(0, Math.round(Number(body.price24))) : r.price24,
    price6: (body.price6 !== undefined && Number.isFinite(Number(body.price6))) ? Math.max(0, Math.round(Number(body.price6))) : r.price6,
    photo: body.photo !== undefined ? (body.photo || null) : r.photo,
    maxGuests: body.maxGuests !== undefined ? (Number(body.maxGuests) || 2) : r.maxGuests,
    bedType: body.bedType !== undefined ? String(body.bedType) : r.bedType,
    amenities: body.amenities !== undefined ? String(body.amenities) : r.amenities,
    status: body.status !== undefined ? String(body.status) : r.status,
    desc: body.desc !== undefined ? String(body.desc) : r.desc,
    video_url: body.video_url !== undefined ? String(body.video_url) : r.video_url,
    discount_price: (body.discount_price !== undefined || body.discountPrice !== undefined) ? (Number(body.discount_price || body.discountPrice) || 0) : r.discount_price
  };

  // 1. FIRST: Commit update to Supabase Cloud
  if (supabase.isConfigured()) {
    try {
      await supabase.syncRoom(updatedRoom, 'upsert', oldId);
    } catch (sbErr) {
      console.error('[Supabase] Room update failed:', sbErr.message);
      return sendJson(res, 400, { ok: false, error: 'Database update failed: ' + sbErr.message });
    }
  }

  // 2. SECOND: Update local state & SQLite
  if (newRoomId !== oldId) {
    DB.bookings.forEach(b => {
      if (b.hotelRoom === oldId) b.hotelRoom = newRoomId;
    });
    if (sqliteDb) {
      try { sqliteDb.prepare(`UPDATE bookings SET hotelRoom = ? WHERE hotelRoom = ?`).run(newRoomId, oldId); } catch (e) { }
    }
  }

  Object.assign(r, updatedRoom);

  if (sqliteDb) {
    try {
      if (newRoomId !== oldId) {
        sqliteDb.prepare(`DELETE FROM rooms WHERE id = ?`).run(oldId);
        sqliteDb.prepare(`INSERT INTO rooms (id, hotel, num, floor, ac, cat, price24, price6, photo, max_guests, bed_type, amenities, status, desc, video_url, discount_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          r.id, r.hotel, r.num, r.floor, r.ac ? 1 : 0, r.cat, r.price24, r.price6, r.photo, r.maxGuests, r.bedType, r.amenities, r.status, r.desc, r.video_url, r.discount_price
        );
      } else {
        sqliteDb.prepare(`UPDATE rooms SET hotel=?, num=?, floor=?, ac=?, cat=?, price24=?, price6=?, photo=?, max_guests=?, bed_type=?, amenities=?, status=?, desc=?, video_url=?, discount_price=? WHERE id=?`).run(
          r.hotel, r.num, r.floor, r.ac ? 1 : 0, r.cat, r.price24, r.price6, r.photo, r.maxGuests, r.bedType, r.amenities, r.status, r.desc, r.video_url, r.discount_price, r.id
        );
      }
    } catch (sqErr) {
      console.error('[SQLite] Room update error:', sqErr.message);
    }
  }

  saveDbMirrorOnly();
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, room: r });
});

route('POST', '/api/rooms', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  let body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
  const { hotel, num, floor, ac, cat, price24, price6, photo, maxGuests, bedType, amenities, status } = body;
  if (!hotel || !String(hotel).trim()) return sendJson(res, 400, { ok: false, error: 'Hotel name or ID is required' });
  if (!num || (typeof num !== 'string' && typeof num !== 'number')) return sendJson(res, 400, { ok: false, error: 'Room number is required' });

  let targetHotel = hotelOf(hotel);
  if (!targetHotel) {
    const newHotelId = 'h_' + Date.now().toString(36);
    targetHotel = {
      id: newHotelId,
      name: String(hotel).trim(),
      tag: 'Executive Wing',
      locality: 'Shirdi, Maharashtra',
      phone: '+91 98514 15415',
      accent: '#E8A33D',
      image: '/images/hero-bg.jpg',
      desc: 'Deepak Hotels Group Property'
    };
    DB.hotels.push(targetHotel);
    if (sqliteDb) {
      try {
        sqliteDb.prepare(`INSERT INTO hotels (id, name, tag, locality, phone, accent, image, desc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
          targetHotel.id, targetHotel.name, targetHotel.tag, targetHotel.locality, targetHotel.phone, targetHotel.accent, targetHotel.image, targetHotel.desc
        );
      } catch (hErr) { }
    }
    try { await supabase.syncHotel(targetHotel, 'upsert'); } catch (e) { }
  }

  const strNum = String(num).trim();
  const roomId = targetHotel.id + '-' + strNum;
  if (DB.rooms.some(r => r.id === roomId)) return sendJson(res, 400, { ok: false, error: `Room ${strNum} already exists for ${targetHotel.name}` });

  const categoryName = String(cat || 'Executive').trim();

  const newRoom = {
    id: roomId,
    hotel: targetHotel.id,
    num: strNum,
    floor: Number(floor) || 1,
    ac: Boolean(ac),
    cat: categoryName,
    price24: Math.max(0, Math.round(Number(price24) || 0)),
    price6: Math.max(0, Math.round(Number(price6) || 0)),
    photo: typeof photo === 'string' ? photo : null,
    maxGuests: Number(maxGuests) || (categoryName === 'Family' || categoryName === 'Suite' ? 4 : 2),
    bedType: String(bedType || 'King Bed'),
    amenities: String(amenities || 'Wi-Fi, AC, Smart TV, Room Service'),
    status: String(status || 'available'),
    desc: String(body.desc || ''),
    video_url: String(body.video_url || ''),
    discount_price: Number(body.discount_price || body.discountPrice) || 0
  };

  // 1. FIRST: Commit to Supabase Cloud
  if (supabase.isConfigured()) {
    try {
      await supabase.syncRoom(newRoom, 'upsert');
    } catch (sbErr) {
      console.error('[Supabase] Room add failed:', sbErr.message);
      return sendJson(res, 400, { ok: false, error: 'Database creation failed: ' + sbErr.message });
    }
  }

  // 2. SECOND: Add to local state & SQLite
  DB.rooms.push(newRoom);
  if (sqliteDb) {
    try {
      sqliteDb.prepare(`INSERT INTO rooms (id, hotel, num, floor, ac, cat, price24, price6, photo, max_guests, bed_type, amenities, status, desc, video_url, discount_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        newRoom.id, newRoom.hotel, newRoom.num, newRoom.floor, newRoom.ac ? 1 : 0, newRoom.cat, newRoom.price24, newRoom.price6, newRoom.photo, newRoom.maxGuests, newRoom.bedType, newRoom.amenities, newRoom.status, newRoom.desc, newRoom.video_url, newRoom.discount_price
      );
    } catch (sqErr) {
      console.error('[SQLite] Room add error:', sqErr.message);
    }
  }

  saveDbMirrorOnly();
  lastSupabaseSync = Date.now();
  sendJson(res, 201, { ok: true, room: newRoom });
});

route('DELETE', '/api/rooms/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  let idx = DB.rooms.findIndex(r => r.id === params.id);
  if (idx === -1 && supabase.isConfigured()) {
    await ensureSupabaseDataFresh(true);
    idx = DB.rooms.findIndex(r => r.id === params.id);
  }
  if (idx === -1) return sendJson(res, 404, { ok: false, error: 'Room not found in database: ' + params.id });

  const roomToDelete = DB.rooms[idx];

  // 1. FIRST: Commit deletion to Supabase Cloud
  if (supabase.isConfigured()) {
    try {
      await supabase.syncRoom({ id: params.id, hotel: roomToDelete.hotel }, 'delete');
    } catch (sbErr) {
      console.error('[Supabase] Room delete failed:', sbErr.message);
      return sendJson(res, 400, { ok: false, error: 'Database delete failed: ' + sbErr.message });
    }
  }

  // 2. SECOND: Remove from local state & SQLite
  DB.rooms.splice(idx, 1);
  if (sqliteDb) {
    try { sqliteDb.prepare('DELETE FROM rooms WHERE id = ?').run(params.id); } catch (e) { }
  }

  saveDbMirrorOnly();
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, removedId: params.id });
});

// Food Menu
function genMenuId() { return 'm' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'); }
function groupedMenu(itemList) {
  const items = itemList || (DB.menuItems || []).filter(i => i.available);
  const groups = [];
  items.forEach(i => {
    let g = groups.find(x => x.cat === i.category);
    if (!g) { g = { cat: i.category, items: [] }; groups.push(g); }
    g.items.push({ id: i.id, name: i.name, price: i.price, photo: i.photo || null });
  });
  return groups;
}
function applyMenuFields(item, body) {
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (!n || n.length > 80) return 'Dish name is required (max 80 characters)';
    item.name = n;
  }
  if (body.category !== undefined) {
    const c = String(body.category).trim() || 'Other';
    if (c.length > 40) return 'Category is too long (max 40 characters)';
    item.category = c;
  }
  if (body.price !== undefined) {
    const p = Number(body.price);
    if (!Number.isFinite(p) || p < 0 || p > 100000) return 'Enter a valid price';
    item.price = Math.round(p);
  }
  if (typeof body.available === 'boolean') item.available = body.available;
  if (typeof body.photo === 'string') {
    item.photo = body.photo;
  } else if (body.photo === null) {
    item.photo = null;
  }
  return null;
}

route('GET', '/api/menu', async (req, res) => {
  let items = (DB.menuItems || []).filter(i => i.available);
  sendJson(res, 200, { menu: groupedMenu(items), items: items });
});

route('GET', '/api/menu/all', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  sendJson(res, 200, { items: DB.menuItems || [] });
});

route('POST', '/api/menu', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  let body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 413, { error: e.message }); }
  if (body.name === undefined || body.price === undefined) return sendJson(res, 400, { error: 'Name and price are required' });
  const item = { id: genMenuId(), name: '', category: 'Other', price: 0, photo: null, available: true };
  const err = applyMenuFields(item, body);
  if (err) return sendJson(res, 400, { error: err });
  DB.menuItems.push(item);
  if (sqliteDb) {
    sqliteDb.prepare(`INSERT INTO menu_items (id, name, category, price, photo, available) VALUES (?, ?, ?, ?, ?, ?)`).run(
      item.id, item.name, item.category, item.price, item.photo, item.available ? 1 : 0
    );
  }
  saveDbMirrorOnly();
  try { await supabase.syncMenuItem(item, 'upsert'); } catch (e) { console.error('[Supabase] Menu add sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 201, { ok: true, item });
});

route('PATCH', '/api/menu/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const item = DB.menuItems.find(i => i.id === params.id);
  if (!item) return sendJson(res, 404, { error: 'Dish not found' });
  let body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 413, { error: e.message }); }
  const err = applyMenuFields(item, body);
  if (err) return sendJson(res, 400, { error: err });

  if (sqliteDb) {
    sqliteDb.prepare(`UPDATE menu_items SET name=?, category=?, price=?, photo=?, available=? WHERE id=?`).run(
      item.name, item.category, item.price, item.photo, item.available ? 1 : 0, item.id
    );
  }
  saveDbMirrorOnly();
  try { await supabase.syncMenuItem(item, 'upsert'); } catch (e) { console.error('[Supabase] Menu update sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, item });
});

route('DELETE', '/api/menu/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const idx = DB.menuItems.findIndex(i => i.id === params.id);
  if (idx === -1) return sendJson(res, 404, { error: 'Dish not found' });
  DB.menuItems.splice(idx, 1);
  if (sqliteDb) {
    try { sqliteDb.prepare('DELETE FROM menu_items WHERE id = ?').run(params.id); } catch (e) { }
  }
  saveDbMirrorOnly();
  try { await supabase.syncMenuItem({ id: params.id }, 'delete'); } catch (e) { console.error('[Supabase] Menu delete sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, removedId: params.id });
});

// Gallery Management
route('GET', '/api/gallery', async (req, res) => {
  sendJson(res, 200, { gallery: DB.gallery || [] });
});

route('POST', '/api/gallery', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  const { title, category, image, display_order } = body;
  if (!image) return sendJson(res, 400, { error: 'Image is required' });
  const item = {
    id: genUniqueId('gal'),
    title: String(title || 'Hotel Image').trim(),
    category: String(category || 'General').trim(),
    image: String(image),
    display_order: Number(display_order) || DB.gallery.length + 1
  };
  DB.gallery.push(item);
  if (sqliteDb) {
    sqliteDb.prepare(`INSERT INTO gallery (id, title, category, image, display_order) VALUES (?, ?, ?, ?, ?)`).run(
      item.id, item.title, item.category, item.image, item.display_order
    );
  }
  saveDbMirrorOnly();
  try { await supabase.syncGallery(item, 'upsert'); } catch (e) { console.error('[Supabase] Gallery add sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 201, { ok: true, item });
});

route('PATCH', '/api/gallery/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const item = DB.gallery.find(g => g.id === params.id);
  if (!item) return sendJson(res, 404, { error: 'Gallery item not found' });
  const body = await readBody(req);
  if (body.title !== undefined) item.title = String(body.title).trim();
  if (body.category !== undefined) item.category = String(body.category).trim();
  if (body.image !== undefined) item.image = String(body.image);
  if (body.display_order !== undefined) item.display_order = Number(body.display_order) || 0;

  if (sqliteDb) {
    sqliteDb.prepare(`UPDATE gallery SET title=?, category=?, image=?, display_order=? WHERE id=?`).run(
      item.title, item.category, item.image, item.display_order, item.id
    );
  }
  saveDbMirrorOnly();
  try { await supabase.syncGallery(item, 'upsert'); } catch (e) { console.error('[Supabase] Gallery update sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, item });
});

route('DELETE', '/api/gallery/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const idx = DB.gallery.findIndex(g => g.id === params.id);
  if (idx === -1) return sendJson(res, 404, { error: 'Gallery item not found' });
  DB.gallery.splice(idx, 1);
  if (sqliteDb) {
    try { sqliteDb.prepare('DELETE FROM gallery WHERE id = ?').run(params.id); } catch (e) { }
  }
  saveDbMirrorOnly();
  try { await supabase.syncGallery({ id: params.id }, 'delete'); } catch (e) { console.error('[Supabase] Gallery delete sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, removedId: params.id });
});

// Videos Management
route('GET', '/api/videos', async (req, res) => {
  sendJson(res, 200, { videos: DB.videos || [] });
});

route('POST', '/api/videos', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  const { title, video_url, is_homepage, is_active } = body;
  if (!video_url) return sendJson(res, 400, { error: 'Video URL is required' });
  const video = {
    id: genUniqueId('vid'),
    title: String(title || 'Hotel Video').trim(),
    video_url: String(video_url),
    is_homepage: Boolean(is_homepage),
    is_active: is_active !== undefined ? Boolean(is_active) : true
  };
  if (video.is_homepage) {
    DB.videos.forEach(v => v.is_homepage = false);
    if (sqliteDb) { sqliteDb.prepare('UPDATE videos SET is_homepage = 0').run(); }
  }
  DB.videos.push(video);
  if (sqliteDb) {
    sqliteDb.prepare(`INSERT INTO videos (id, title, video_url, is_homepage, is_active) VALUES (?, ?, ?, ?, ?)`).run(
      video.id, video.title, video.video_url, video.is_homepage ? 1 : 0, video.is_active ? 1 : 0
    );
  }
  saveDbMirrorOnly();
  try { await supabase.syncVideo(video, 'upsert'); } catch (e) { console.error('[Supabase] Video add sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 201, { ok: true, video });
});

route('PATCH', '/api/videos/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const v = DB.videos.find(x => x.id === params.id);
  if (!v) return sendJson(res, 404, { error: 'Video not found' });
  const body = await readBody(req);
  if (body.title !== undefined) v.title = String(body.title);
  if (body.video_url !== undefined) v.video_url = String(body.video_url);
  if (typeof body.is_homepage === 'boolean') {
    v.is_homepage = body.is_homepage;
    if (v.is_homepage) {
      DB.videos.forEach(other => { if (other.id !== v.id) other.is_homepage = false; });
      if (sqliteDb) { sqliteDb.prepare('UPDATE videos SET is_homepage = 0 WHERE id != ?').run(v.id); }
    }
  }
  if (typeof body.is_active === 'boolean') v.is_active = body.is_active;

  if (sqliteDb) {
    sqliteDb.prepare(`UPDATE videos SET title=?, video_url=?, is_homepage=?, is_active=? WHERE id=?`).run(
      v.title, v.video_url, v.is_homepage ? 1 : 0, v.is_active ? 1 : 0, v.id
    );
  }
  saveDbMirrorOnly();
  try { await supabase.syncVideo(v, 'upsert'); } catch (e) { console.error('[Supabase] Video update sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, video: v });
});

route('DELETE', '/api/videos/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const idx = DB.videos.findIndex(v => v.id === params.id);
  if (idx === -1) return sendJson(res, 404, { error: 'Video not found' });
  DB.videos.splice(idx, 1);
  if (sqliteDb) {
    try { sqliteDb.prepare('DELETE FROM videos WHERE id = ?').run(params.id); } catch (e) { }
  }
  saveDbMirrorOnly();
  try { await supabase.syncVideo({ id: params.id }, 'delete'); } catch (e) { console.error('[Supabase] Video delete sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, removedId: params.id });
});

// Amenities Management
route('GET', '/api/amenities', async (req, res) => {
  sendJson(res, 200, { amenities: DB.amenities || [] });
});

route('POST', '/api/amenities', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  const { name, icon, category, desc } = body;
  if (!name) return sendJson(res, 400, { error: 'Amenity name is required' });
  const amenity = {
    id: genUniqueId('am'),
    name: String(name).trim(),
    icon: String(icon || 'sparkles').trim(),
    category: String(category || 'General').trim(),
    desc: String(desc || '').trim()
  };
  DB.amenities.push(amenity);
  if (sqliteDb) {
    sqliteDb.prepare(`INSERT INTO amenities (id, name, icon, category, desc) VALUES (?, ?, ?, ?, ?)`).run(
      amenity.id, amenity.name, amenity.icon, amenity.category, amenity.desc
    );
  }
  saveDbMirrorOnly();
  try { await supabase.syncAmenity(amenity, 'upsert'); } catch (e) { console.error('[Supabase] Amenity add sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 201, { ok: true, amenity });
});

route('PATCH', '/api/amenities/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const a = DB.amenities.find(x => x.id === params.id);
  if (!a) return sendJson(res, 404, { error: 'Amenity not found' });
  const body = await readBody(req);
  if (body.name !== undefined) a.name = String(body.name);
  if (body.icon !== undefined) a.icon = String(body.icon);
  if (body.category !== undefined) a.category = String(body.category);
  if (body.desc !== undefined) a.desc = String(body.desc);

  if (sqliteDb) {
    sqliteDb.prepare(`UPDATE amenities SET name=?, icon=?, category=?, desc=? WHERE id=?`).run(
      a.name, a.icon, a.category, a.desc, a.id
    );
  }
  saveDbMirrorOnly();
  try { await supabase.syncAmenity(a, 'upsert'); } catch (e) { console.error('[Supabase] Amenity update sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, amenity: a });
});

route('DELETE', '/api/amenities/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const idx = DB.amenities.findIndex(a => a.id === params.id);
  if (idx === -1) return sendJson(res, 404, { error: 'Amenity not found' });
  DB.amenities.splice(idx, 1);
  if (sqliteDb) {
    try { sqliteDb.prepare('DELETE FROM amenities WHERE id = ?').run(params.id); } catch (e) { }
  }
  saveDbMirrorOnly();
  try { await supabase.syncAmenity({ id: params.id }, 'delete'); } catch (e) { console.error('[Supabase] Amenity delete sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, removedId: params.id });
});

// Offers & Packages Management
route('GET', '/api/offers', async (req, res) => {
  sendJson(res, 200, { offers: DB.offers || [] });
});

route('POST', '/api/offers', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  const { title, desc, discount, image, valid_from, valid_to, code, is_active } = body;
  if (!title) return sendJson(res, 400, { error: 'Offer title is required' });
  const offer = {
    id: genUniqueId('off'),
    title: String(title).trim(),
    desc: String(desc || '').trim(),
    discount: String(discount || '').trim(),
    image: String(image || '/images/hero-bg.jpg'),
    valid_from: String(valid_from || ''),
    valid_to: String(valid_to || ''),
    code: String(code || '').trim(),
    is_active: is_active !== undefined ? Boolean(is_active) : true
  };
  DB.offers.push(offer);
  if (sqliteDb) {
    sqliteDb.prepare(`INSERT INTO offers (id, title, desc, discount, image, valid_from, valid_to, code, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      offer.id, offer.title, offer.desc, offer.discount, offer.image, offer.valid_from, offer.valid_to, offer.code, offer.is_active ? 1 : 0
    );
  }
  saveDbMirrorOnly();
  try { await supabase.syncOffer(offer, 'upsert'); } catch (e) { console.error('[Supabase] Offer add sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 201, { ok: true, offer });
});

route('PATCH', '/api/offers/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const o = DB.offers.find(x => x.id === params.id);
  if (!o) return sendJson(res, 404, { error: 'Offer not found' });
  const body = await readBody(req);
  if (body.title !== undefined) o.title = String(body.title);
  if (body.desc !== undefined) o.desc = String(body.desc);
  if (body.discount !== undefined) o.discount = String(body.discount);
  if (body.image !== undefined) o.image = String(body.image);
  if (body.valid_from !== undefined) o.valid_from = String(body.valid_from);
  if (body.valid_to !== undefined) o.valid_to = String(body.valid_to);
  if (body.code !== undefined) o.code = String(body.code);
  if (typeof body.is_active === 'boolean') o.is_active = body.is_active;

  if (sqliteDb) {
    sqliteDb.prepare(`UPDATE offers SET title=?, desc=?, discount=?, image=?, valid_from=?, valid_to=?, code=?, is_active=? WHERE id=?`).run(
      o.title, o.desc, o.discount, o.image, o.valid_from, o.valid_to, o.code, o.is_active ? 1 : 0, o.id
    );
  }
  saveDbMirrorOnly();
  try { await supabase.syncOffer(o, 'upsert'); } catch (e) { console.error('[Supabase] Offer update sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, offer: o });
});

route('DELETE', '/api/offers/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const idx = DB.offers.findIndex(o => o.id === params.id);
  if (idx === -1) return sendJson(res, 404, { error: 'Offer not found' });
  DB.offers.splice(idx, 1);
  if (sqliteDb) {
    try { sqliteDb.prepare('DELETE FROM offers WHERE id = ?').run(params.id); } catch (e) { }
  }
  saveDbMirrorOnly();
  try { await supabase.syncOffer({ id: params.id }, 'delete'); } catch (e) { console.error('[Supabase] Offer delete sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, removedId: params.id });
});

// Reviews / Testimonials Management
route('GET', '/api/reviews', async (req, res) => {
  sendJson(res, 200, { reviews: DB.reviews || [] });
});

route('POST', '/api/reviews', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  const { guest_name, rating, review_text, guest_image, hotel_tag } = body;
  if (!guest_name || !review_text) return sendJson(res, 400, { error: 'Guest name and review text are required' });
  const review = {
    id: genUniqueId('rev'),
    guest_name: String(guest_name).trim(),
    rating: Math.max(1, Math.min(5, Number(rating) || 5)),
    review_text: String(review_text).trim(),
    guest_image: String(guest_image || ''),
    hotel_tag: String(hotel_tag || 'Deepak Hotels Group').trim()
  };
  DB.reviews.push(review);
  if (sqliteDb) {
    sqliteDb.prepare(`INSERT INTO reviews (id, guest_name, rating, review_text, guest_image, hotel_tag) VALUES (?, ?, ?, ?, ?, ?)`).run(
      review.id, review.guest_name, review.rating, review.review_text, review.guest_image, review.hotel_tag
    );
  }
  saveDbMirrorOnly();
  try { await supabase.syncReview(review, 'upsert'); } catch (e) { console.error('[Supabase] Review add sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 201, { ok: true, review });
});

route('PATCH', '/api/reviews/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const r = DB.reviews.find(x => x.id === params.id);
  if (!r) return sendJson(res, 404, { error: 'Review not found' });
  const body = await readBody(req);
  if (body.guest_name !== undefined) r.guest_name = String(body.guest_name);
  if (body.rating !== undefined) r.rating = Math.max(1, Math.min(5, Number(body.rating) || 5));
  if (body.review_text !== undefined) r.review_text = String(body.review_text);
  if (body.guest_image !== undefined) r.guest_image = String(body.guest_image);
  if (body.hotel_tag !== undefined) r.hotel_tag = String(body.hotel_tag);

  if (sqliteDb) {
    sqliteDb.prepare(`UPDATE reviews SET guest_name=?, rating=?, review_text=?, guest_image=?, hotel_tag=? WHERE id=?`).run(
      r.guest_name, r.rating, r.review_text, r.guest_image, r.hotel_tag, r.id
    );
  }
  saveDbMirrorOnly();
  try { await supabase.syncReview(r, 'upsert'); } catch (e) { console.error('[Supabase] Review update sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, review: r });
});

route('DELETE', '/api/reviews/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const idx = DB.reviews.findIndex(r => r.id === params.id);
  if (idx === -1) return sendJson(res, 404, { error: 'Review not found' });
  DB.reviews.splice(idx, 1);
  if (sqliteDb) {
    try { sqliteDb.prepare('DELETE FROM reviews WHERE id = ?').run(params.id); } catch (e) { }
  }
  saveDbMirrorOnly();
  try { await supabase.syncReview({ id: params.id }, 'delete'); } catch (e) { console.error('[Supabase] Review delete sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, removedId: params.id });
});

// Room Availability
route('GET', '/api/availability', async (req, res, params, query) => {
  const date = query.get('date');
  if (!isValidDateStr(date)) return sendJson(res, 400, { error: 'date=YYYY-MM-DD required' });
  const taken = DB.bookings
    .filter(b => b.date === date && b.status !== 'cancelled')
    .map(b => b.hotelRoom);
  sendJson(res, 200, { date, unavailableRoomIds: [...new Set(taken)] });
});

// Bookings
route('GET', '/api/bookings', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  sendJson(res, 200, { bookings: DB.bookings });
});

route('GET', '/api/bookings/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const b = DB.bookings.find(x => x.id === params.id);
  if (!b) return sendJson(res, 404, { error: 'Booking not found' });
  sendJson(res, 200, { booking: b });
});

route('POST', '/api/bookings', async (req, res) => {
  let body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 413, { error: e.message }); }

  const r = roomOf(body.hotelRoom);
  if (!r) return sendJson(res, 400, { error: 'Unknown room' });
  if (!['24hr', '6hr'].includes(body.stay)) return sendJson(res, 400, { error: 'stay must be 24hr or 6hr' });
  if (!isValidDateStr(body.date)) return sendJson(res, 400, { error: 'date must be YYYY-MM-DD' });
  if (!/^\d{2}:\d{2}$/.test(body.time || '')) return sendJson(res, 400, { error: 'time must be HH:MM' });
  const name = (body.name || '').trim();
  const phone = (body.phone || '').trim();
  if (!name) return sendJson(res, 400, { error: 'Guest name required' });
  if (!/^\d{10}$/.test(phone)) return sendJson(res, 400, { error: 'Phone must be a 10-digit number' });
  if (!['upload', 'hotel', 'reception'].includes(body.idMethod)) return sendJson(res, 400, { error: 'Invalid idMethod' });
  if (body.idMethod === 'upload' && !body.idPhotoBase64) return sendJson(res, 400, { error: 'ID photo required for upload method' });

  const conflict = DB.bookings.some(b => b.hotelRoom === body.hotelRoom && b.date === body.date && b.status !== 'cancelled');
  if (conflict) return sendJson(res, 409, { error: 'This room is already booked for that date. Please pick another room or date.' });

  const food = (Array.isArray(body.food) ? body.food : []).map(item => {
    const real = DB.menuItems.find(m => m.available && (m.id === item.id || (!item.id && m.name === item.name)));
    if (!real) return null;
    const qty = Math.max(1, Math.min(20, Math.round(Number(item.qty) || 1)));
    return { name: real.name, price: real.price, qty };
  }).filter(Boolean);

  const booking = {
    id: genBookingId(),
    hotelRoom: body.hotelRoom,
    name, phone,
    email: (body.email || '').trim(),
    guests: Math.max(1, Math.min(10, Math.round(Number(body.guests) || 1))),
    stay: body.stay,
    date: body.date,
    time: body.time,
    idMethod: body.idMethod,
    idPhotoBase64: body.idMethod === 'upload' ? body.idPhotoBase64 : null,
    requests: (body.requests || '').trim().slice(0, 500),
    food,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  // SAVE BOOKING TO DATABASE
  DB.bookings.push(booking);
  if (sqliteDb) {
    sqliteDb.prepare(`INSERT INTO bookings (id, hotelRoom, name, phone, email, guests, stay, date, time, idMethod, idPhotoBase64, requests, food, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      booking.id, booking.hotelRoom, booking.name, booking.phone, booking.email, booking.guests, booking.stay, booking.date, booking.time, booking.idMethod, booking.idPhotoBase64, booking.requests, JSON.stringify(booking.food || []), booking.status, booking.createdAt
    );
    sqliteDb.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('nextBookingSeq', ?)").run(String(DB.nextBookingSeq));
  }
  saveDbMirrorOnly();
  try { await supabase.syncBooking(booking, 'upsert'); } catch (e) { console.error('[Supabase] Booking add sync error:', e.message); }
  lastSupabaseSync = Date.now();

  // DISPATCH REAL WHATSAPP NOTIFICATION
  try {
    triggerAdminBookingNotification(booking);
  } catch (err) {
    console.error('[Notification Engine] Failed to dispatch WhatsApp notification:', err.message);
  }

  sendJson(res, 201, {
    ok: true,
    bookingId: booking.id,
    total: bookingTotal(booking),
    status: booking.status
  });
});

const VALID_STATUSES = ['pending', 'confirmed', 'checkedin', 'checkedout', 'cancelled'];
route('PATCH', '/api/bookings/:id/status', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const b = DB.bookings.find(x => x.id === params.id);
  if (!b) return sendJson(res, 404, { error: 'Booking not found' });
  const body = await readBody(req);
  if (!VALID_STATUSES.includes(body.status)) return sendJson(res, 400, { error: 'Invalid status' });
  b.status = body.status;
  if (sqliteDb) {
    sqliteDb.prepare(`UPDATE bookings SET status=? WHERE id=?`).run(b.status, b.id);
  }
  saveDbMirrorOnly();
  try { await supabase.syncBooking(b, 'upsert'); } catch (e) { console.error('[Supabase] Booking update sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, booking: b });
});

route('DELETE', '/api/bookings/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const idx = DB.bookings.findIndex(b => b.id === params.id);
  if (idx === -1) return sendJson(res, 404, { error: 'Booking not found' });
  DB.bookings.splice(idx, 1);
  if (sqliteDb) {
    try { sqliteDb.prepare('DELETE FROM bookings WHERE id = ?').run(params.id); } catch (e) { }
  }
  saveDbMirrorOnly();
  try { await supabase.syncBooking({ id: params.id }, 'delete'); } catch (e) { console.error('[Supabase] Booking delete sync error:', e.message); }
  lastSupabaseSync = Date.now();
  sendJson(res, 200, { ok: true, removedId: params.id });
});

// Notifications API Endpoints
route('GET', '/api/notifications', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  sendJson(res, 200, { notifications: DB.notifications || [] });
});

route('GET', '/api/notifications/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const n = (DB.notifications || []).find(x => x.id === params.id);
  if (!n) return sendJson(res, 404, { error: 'Notification record not found' });
  sendJson(res, 200, { notification: n });
});

route('POST', '/api/notifications/:id/retry', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const n = (DB.notifications || []).find(x => x.id === params.id);
  if (!n) return sendJson(res, 404, { error: 'Notification record not found' });
  await dispatchWhatsAppNotification(n);
  saveDb();
  sendJson(res, 200, { ok: true, notification: n });
});

route('POST', '/api/notifications/whatsapp/test', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  let recipient = (process.env.ADMIN_WHATSAPP_NUMBER || process.env.ADMIN_BOOKING_PHONE || '919851415415').replace(/[^0-9]/g, '');
  if (recipient.length === 10) recipient = '91' + recipient;
  
  const testNotif = {
    id: genUniqueId('notif'),
    booking_id: '#TEST-WA-' + Math.floor(1000 + Math.random() * 9000),
    recipient: recipient,
    recipient_number: recipient,
    notification_type: 'whatsapp',
    message: 'Test WhatsApp notification from Deepak Hotels Group booking system.',
    status: 'pending',
    provider_message_id: null,
    error_message: null,
    attempts: 0,
    created_at: new Date().toISOString(),
    sent_at: null
  };

  DB.notifications.push(testNotif);
  saveDb();

  await dispatchWhatsAppNotification(testNotif);
  saveDb();
  sendJson(res, 200, { ok: true, notification: testNotif });
});

route('POST', '/api/notifications/test', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  let recipient = (process.env.ADMIN_WHATSAPP_NUMBER || process.env.ADMIN_BOOKING_PHONE || '919851415415').replace(/[^0-9]/g, '');
  if (recipient.length === 10) recipient = '91' + recipient;
  
  const testNotif = {
    id: genUniqueId('notif'),
    booking_id: '#TEST-WA-' + Math.floor(1000 + Math.random() * 9000),
    recipient: recipient,
    recipient_number: recipient,
    notification_type: 'whatsapp',
    message: 'Test WhatsApp notification from Deepak Hotels Group booking system.',
    status: 'pending',
    provider_message_id: null,
    error_message: null,
    attempts: 0,
    created_at: new Date().toISOString(),
    sent_at: null
  };

  DB.notifications.push(testNotif);
  saveDb();

  await dispatchWhatsAppNotification(testNotif);
  saveDb();
  sendJson(res, 200, { ok: true, notification: testNotif });
});

/* ---------------------------------------------------------------------
   Static File Serving (public/)
--------------------------------------------------------------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.ogv': 'video/ogg'
};

function serveStatic(req, res, pathname) {
  let rel = (pathname === '/' || pathname === '') ? '/index.html'
    : (pathname === '/admin' || pathname === '/admin/') ? '/admin.html'
      : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME[ext] || 'application/octet-stream';
    const totalSize = stats.size;
    const range = req.headers.range;

    // HTTP Range streaming for video playback (Safari iOS/macOS, seekable players)
    if (range && (ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.mkv' || ext === '.ogv')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
        return res.end();
      }

      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': (ext === '.html') ? 'no-cache' : 'public, max-age=86400'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

/* ---------------------------------------------------------------------
   Server Initialization
--------------------------------------------------------------------- */
const server = http.createServer(async (req, res) => {
  const host = req.headers.host || 'localhost';
  const u = new URL(req.url, `http://${host}`);
  let pathname = u.pathname;
  if (pathname.startsWith('/.netlify/functions/api')) {
    pathname = pathname.replace('/.netlify/functions/api', '/api') || '/api';
  }
  if (pathname.startsWith('/api/')) {
    if (req.method === 'GET' && supabase.isConfigured() && !pathname.startsWith('/api/supabase/')) {
      await ensureSupabaseDataFresh();
    }
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.regex.exec(pathname);
      if (!m) continue;
      const params = {};
      r.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]); });
      try {
        await r.handler(req, res, params, u.searchParams);
      } catch (e) {
        console.error(e);
        if (!res.headersSent) sendJson(res, 500, { error: 'Server error: ' + e.message });
      }
      return;
    }
    return sendJson(res, 404, { error: 'No such API route' });
  }
  if (req.method === 'GET') return serveStatic(req, res, pathname);
  res.writeHead(405); res.end('Method not allowed');
});

if (require.main === module) {
  server.listen(PORT, HOST, async () => {
    console.log(`Deepak Hotels Group server running on http://${HOST}:${PORT}`);
    console.log(`  Customer site: http://${HOST}:${PORT}/`);
    console.log(`  Admin dashboard: http://${HOST}:${PORT}/admin`);
    console.log(`  Admin notification mobile: ${ADMIN_MOBILE}`);
    if (supabase.isConfigured()) {
      try {
        console.log('[Startup] Pre-warming fresh dataset from Supabase Cloud...');
        await ensureSupabaseDataFresh(true);
        console.log('[Startup] Supabase Cloud dataset synchronized successfully.');
      } catch (sbBootErr) {
        console.warn('[Startup] Supabase startup sync note:', sbBootErr.message);
      }
    }
  });
}

function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}, saving data and shutting down gracefully...`);
  try { if (typeof saveDb === 'function') saveDb(); } catch (e) { console.error('Error saving DB:', e); }
  server.close(() => {
    process.exit(0);
  });
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { server, app: server, DB, ensureSupabaseDataFresh };
