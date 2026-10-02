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

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const ADMIN_MOBILE = process.env.ADMIN_BOOKING_PHONE || process.env.ADMIN_MOBILE_NUMBER || '+919851415415';
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP_NUMBER || '919851415415';

// Ensure uploads directory exists
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* ---------------------------------------------------------------------
   DEFAULT SEED DATA
--------------------------------------------------------------------- */
const SEED_HOTELS = [
  { id: 'sv1', name: 'Hotel Sai View', tag: 'The Original Luxury Wing', locality: 'Vivekanand nagar, Manmad Rd, near S T Bus stand, Shirdi, Maharashtra 423109', phone: '+91 98514 15415', accent: '#E8A33D', image: '/images/hotel-sai-view.jpg', desc: 'Our flagship luxury property featuring 10 executive rooms, 24/7 dining, and panoramic temple views.' },
  { id: 'sv2', name: 'Hotel Sai Santosh', tag: 'The Grand Family Wing', locality: 'City market road, Gaikwad chowk, near Adarsha school, Shirdi, Maharashtra 423109', phone: '+91 83293 21838', accent: '#2F6E62', image: '/images/hotel-sai-santosh.jpg', desc: 'A serene sanctuary popular with families, 20 spacious suites with private courtyard and ample parking.' },
  { id: 'sv3', name: 'Hotel Om Sai', tag: 'The Highway Express Stop', locality: 'Vivekanand Nagar, Manmad Rd, Sai Nagar, Shirdi, Maharashtra 423109', phone: '+91 90227 51848', accent: '#7C2D2D', image: '/images/hotel-om-sai.jpg', desc: 'Modern high-comfort express hotel for travellers, 10 rooms with instant 6-hour & 24-hour check-in.' }
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
  ['sv2', '305', 3, true, 'Suite', 3800, 2300, 4, 'Royal Suite Bed', 'Wi-Fi, AC, Smart TV, Lounge'],
  ['sv2', '401', 4, true, 'Family', 2900, 1750, 4, '2 King Beds', 'Wi-Fi, AC, Smart TV'],
  ['sv2', '402', 4, false, 'Couple', 1450, 850, 2, 'Queen Bed', 'Wi-Fi, TV'],
  ['sv2', '403', 4, true, 'Couple', 2100, 1250, 2, 'King Bed', 'Wi-Fi, AC, Smart TV'],
  ['sv2', '404', 4, true, 'Suite', 3800, 2300, 4, 'Royal Suite Bed', 'Wi-Fi, AC, Smart TV, Lounge'],
  ['sv2', '405', 4, true, 'Suite', 3800, 2300, 4, 'Royal Suite Bed', 'Wi-Fi, AC, Smart TV, Lounge'],
  
  ['sv3', '301', 1, false, 'Single', 1100, 650, 1, 'Single Bed', 'Wi-Fi, TV'],
  ['sv3', '302', 1, false, 'Single', 1100, 650, 1, 'Single Bed', 'Wi-Fi, TV'],
  ['sv3', '303', 1, true, 'Couple', 2100, 1250, 2, 'King Bed', 'Wi-Fi, AC, Smart TV'],
  ['sv3', '304', 1, false, 'Couple', 1450, 850, 2, 'Queen Bed', 'Wi-Fi, TV'],
  ['sv3', '305', 1, true, 'Couple', 2100, 1250, 2, 'King Bed', 'Wi-Fi, AC, Smart TV'],
  ['sv3', '401', 2, false, 'Family', 2100, 1250, 4, '2 Double Beds', 'Wi-Fi, TV'],
  ['sv3', '402', 2, true, 'Family', 2900, 1750, 4, '2 King Beds', 'Wi-Fi, AC, Smart TV'],
  ['sv3', '403', 2, true, 'Family', 2900, 1750, 4, '2 King Beds', 'Wi-Fi, AC, Smart TV'],
  ['sv3', '404', 2, false, 'Couple', 1450, 850, 2, 'Queen Bed', 'Wi-Fi, TV'],
  ['sv3', '405', 2, true, 'Suite', 3800, 2300, 4, 'Royal Suite Bed', 'Wi-Fi, AC, Smart TV']
];

const SEED_ROOMS = SEED_ROOMS_RAW.map(([hotel, num, floor, ac, cat, price24, price6, maxGuests, bedType, amenities]) => ({
  id: hotel + '-' + num,
  hotel, num, floor,
  ac: Boolean(ac),
  cat, price24, price6,
  photo: cat === 'Suite' ? '/images/room-suite.jpg' : null,
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
  { id: 'vid1', title: 'Deepak Hotels Group Luxury Walkthrough', video_url: 'https://www.w3schools.com/html/mov_bbb.mp4', is_homepage: 1, is_active: 1 }
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
   DATABASE ENGINE — SQLite Database (via node:sqlite) with dual-sync
--------------------------------------------------------------------- */
const SQLITE_PATH = path.join(DATA_DIR, 'deepak_hotels.db');
let sqliteDb = null;

function initSqliteDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
        desc TEXT
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
    addColumnIfMissing('notifications', 'recipient_number', 'TEXT');
    addColumnIfMissing('notifications', 'recipient', 'TEXT');

    console.log(`[Database] SQLite database initialized at: ${SQLITE_PATH}`);
  } catch (err) {
    console.log('[Database] Running fallback JSON file database storage engine.', err.message);
    sqliteDb = null;
  }
}

function syncDbToSqlite() {
  if (!sqliteDb || !DB) return;
  try {
    sqliteDb.exec('BEGIN TRANSACTION;');

    // Hotels
    sqliteDb.exec('DELETE FROM hotels;');
    const insertHotel = sqliteDb.prepare(`INSERT INTO hotels (id, name, tag, locality, phone, accent, image, desc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    (DB.hotels || []).forEach(h => insertHotel.run(
      String(h.id || ''), String(h.name || ''), String(h.tag || ''), String(h.locality || ''), String(h.phone || ''), String(h.accent || ''), String(h.image || ''), String(h.desc || '')
    ));

    // Rooms
    sqliteDb.exec('DELETE FROM rooms;');
    const insertRoom = sqliteDb.prepare(`INSERT INTO rooms (id, hotel, num, floor, ac, cat, price24, price6, photo, max_guests, bed_type, amenities, status, desc, video_url, discount_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    (DB.rooms || []).forEach(r => insertRoom.run(
      String(r.id || ''), String(r.hotel || ''), String(r.num || ''), Number(r.floor) || 1, r.ac ? 1 : 0, String(r.cat || 'Single'),
      Number(r.price24) || 0, Number(r.price6) || 0, r.photo || null, Number(r.maxGuests || r.max_guests) || 2, String(r.bedType || r.bed_type || 'King Bed'), String(r.amenities || 'Wi-Fi, AC, TV'), String(r.status || 'available'),
      String(r.desc || ''), String(r.video_url || ''), Number(r.discount_price || r.discountPrice) || 0
    ));

    // Menu items
    sqliteDb.exec('DELETE FROM menu_items;');
    const insertMenu = sqliteDb.prepare(`INSERT INTO menu_items (id, name, category, price, photo, available) VALUES (?, ?, ?, ?, ?, ?)`);
    (DB.menuItems || []).forEach(i => insertMenu.run(
      String(i.id || ''), String(i.name || ''), String(i.category || 'Other'), Number(i.price) || 0, i.photo || null, i.available ? 1 : 0
    ));

    // Bookings
    sqliteDb.exec('DELETE FROM bookings;');
    const insertBooking = sqliteDb.prepare(`INSERT INTO bookings (id, hotelRoom, name, phone, email, guests, stay, date, time, idMethod, idPhotoBase64, requests, food, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    (DB.bookings || []).forEach(b => insertBooking.run(
      String(b.id || ''), String(b.hotelRoom || ''), String(b.name || ''), String(b.phone || ''), String(b.email || ''), Number(b.guests) || 1, String(b.stay || '24hr'), String(b.date || ''), String(b.time || ''), String(b.idMethod || 'hotel'), b.idPhotoBase64 || null, String(b.requests || ''), JSON.stringify(b.food || []), String(b.status || 'pending'), String(b.createdAt || new Date().toISOString())
    ));

    // Admins
    sqliteDb.exec('DELETE FROM admins;');
    const insertAdmin = sqliteDb.prepare(`INSERT INTO admins (username, salt, hash) VALUES (?, ?, ?)`);
    (DB.admins || []).forEach(a => insertAdmin.run(
      String(a.username || ''), String(a.salt || ''), String(a.hash || '')
    ));

    // Metadata
    const insertMeta = sqliteDb.prepare(`INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)`);
    insertMeta.run('nextBookingSeq', String(DB.nextBookingSeq || 1));

    // Settings
    sqliteDb.exec('DELETE FROM website_settings;');
    const insertSetting = sqliteDb.prepare(`INSERT INTO website_settings (key, value) VALUES (?, ?)`);
    Object.entries(DB.settings || {}).forEach(([k, v]) => insertSetting.run(String(k), String(v || '')));

    // Hero
    sqliteDb.exec('DELETE FROM hero_settings;');
    const insertHero = sqliteDb.prepare(`INSERT INTO hero_settings (key, value) VALUES (?, ?)`);
    Object.entries(DB.hero || {}).forEach(([k, v]) => insertHero.run(String(k), String(v || '')));

    // Gallery
    sqliteDb.exec('DELETE FROM gallery;');
    const insertGal = sqliteDb.prepare(`INSERT INTO gallery (id, title, category, image, display_order) VALUES (?, ?, ?, ?, ?)`);
    (DB.gallery || []).forEach(g => insertGal.run(String(g.id || ''), String(g.title || ''), String(g.category || 'General'), String(g.image || ''), Number(g.display_order) || 0));

    // Videos
    sqliteDb.exec('DELETE FROM videos;');
    const insertVid = sqliteDb.prepare(`INSERT INTO videos (id, title, video_url, is_homepage, is_active) VALUES (?, ?, ?, ?, ?)`);
    (DB.videos || []).forEach(v => insertVid.run(String(v.id || ''), String(v.title || ''), String(v.video_url || ''), v.is_homepage ? 1 : 0, v.is_active ? 1 : 0));

    // Amenities
    sqliteDb.exec('DELETE FROM amenities;');
    const insertAm = sqliteDb.prepare(`INSERT INTO amenities (id, name, icon, category, desc) VALUES (?, ?, ?, ?, ?)`);
    (DB.amenities || []).forEach(a => insertAm.run(String(a.id || ''), String(a.name || ''), String(a.icon || ''), String(a.category || 'General'), String(a.desc || '')));

    // Offers
    sqliteDb.exec('DELETE FROM offers;');
    const insertOff = sqliteDb.prepare(`INSERT INTO offers (id, title, desc, discount, image, valid_from, valid_to, code, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    (DB.offers || []).forEach(o => insertOff.run(String(o.id || ''), String(o.title || ''), String(o.desc || ''), String(o.discount || ''), String(o.image || ''), String(o.valid_from || ''), String(o.valid_to || ''), String(o.code || ''), o.is_active ? 1 : 0));

    // Reviews
    sqliteDb.exec('DELETE FROM reviews;');
    const insertRev = sqliteDb.prepare(`INSERT INTO reviews (id, guest_name, rating, review_text, guest_image, hotel_tag) VALUES (?, ?, ?, ?, ?, ?)`);
    (DB.reviews || []).forEach(r => insertRev.run(String(r.id || ''), String(r.guest_name || ''), Number(r.rating) || 5, String(r.review_text || ''), String(r.guest_image || ''), String(r.hotel_tag || '')));

    // Notifications
    sqliteDb.exec('DELETE FROM notifications;');
    const insertNotif = sqliteDb.prepare(`INSERT INTO notifications (id, booking_id, recipient_number, notification_type, message, status, provider_message_id, error_message, attempts, created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    (DB.notifications || []).forEach(n => insertNotif.run(
      String(n.id || ''), String(n.booking_id || ''), String(n.recipient_number || n.recipient || ADMIN_MOBILE), String(n.notification_type || 'sms'), String(n.message || ''),
      String(n.status || 'pending'), n.provider_message_id || null, n.error_message || null, Number(n.attempts) || 1, String(n.created_at || ''), n.sent_at || null
    ));

    sqliteDb.exec('COMMIT;');
  } catch (err) {
    try { sqliteDb.exec('ROLLBACK;'); } catch (e) { }
    console.error('[Database] SQLite sync warning:', err.message);
  }
}

function loadDbFromSqlite() {
  if (!sqliteDb) return false;
  try {
    const hotelRows = sqliteDb.prepare('SELECT * FROM hotels').all();
    if (!hotelRows || !hotelRows.length) return false;

    const roomRows = sqliteDb.prepare('SELECT * FROM rooms').all() || [];
    const menuRows = sqliteDb.prepare('SELECT * FROM menu_items').all() || [];
    const bookingRows = sqliteDb.prepare('SELECT * FROM bookings').all() || [];
    const adminRows = sqliteDb.prepare('SELECT * FROM admins').all() || [];
    const metaRow = sqliteDb.prepare("SELECT value FROM metadata WHERE key = 'nextBookingSeq'").get();
    const settingRows = sqliteDb.prepare('SELECT * FROM website_settings').all() || [];
    const heroRows = sqliteDb.prepare('SELECT * FROM hero_settings').all() || [];
    const galleryRows = sqliteDb.prepare('SELECT * FROM gallery').all() || [];
    const videoRows = sqliteDb.prepare('SELECT * FROM videos').all() || [];
    const amenityRows = sqliteDb.prepare('SELECT * FROM amenities').all() || [];
    const offerRows = sqliteDb.prepare('SELECT * FROM offers').all() || [];
    const reviewRows = sqliteDb.prepare('SELECT * FROM reviews').all() || [];
    let notifRows = [];
    try { notifRows = sqliteDb.prepare('SELECT * FROM notifications').all() || []; } catch (e) { }

    const settings = { ...SEED_SETTINGS };
    settingRows.forEach(s => { settings[s.key] = s.value; });

    const hero = { ...SEED_HERO };
    heroRows.forEach(h => { hero[h.key] = h.value; });

    DB = {
      hotels: hotelRows.map(h => ({
        id: h.id, name: h.name, tag: h.tag, locality: h.locality, phone: h.phone, accent: h.accent, image: h.image, desc: h.desc
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
    console.error('[Database] Failed to read from SQLite database:', err.message);
    return false;
  }
}

let DB;
function loadDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  initSqliteDatabase();

  let loaded = false;
  if (sqliteDb) {
    loaded = loadDbFromSqlite();
  }

  if (!loaded && fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.hotels) && parsed.hotels.length > 0) {
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

  // Schema fallbacks
  if (!Array.isArray(DB.hotels) || DB.hotels.length === 0) DB.hotels = SEED_HOTELS;
  if (!Array.isArray(DB.rooms) || DB.rooms.length === 0) DB.rooms = SEED_ROOMS;
  if (!Array.isArray(DB.menuItems)) DB.menuItems = [];
  if (!Array.isArray(DB.bookings)) DB.bookings = [];
  if (!DB.settings) DB.settings = { ...SEED_SETTINGS };
  if (!DB.hero) DB.hero = { ...SEED_HERO };
  if (!Array.isArray(DB.amenities) || DB.amenities.length === 0) DB.amenities = SEED_AMENITIES;
  if (!Array.isArray(DB.offers) || DB.offers.length === 0) DB.offers = SEED_OFFERS;
  if (!Array.isArray(DB.reviews) || DB.reviews.length === 0) DB.reviews = SEED_REVIEWS;
  if (!Array.isArray(DB.gallery) || DB.gallery.length === 0) DB.gallery = SEED_GALLERY;
  if (!Array.isArray(DB.videos) || DB.videos.length === 0) DB.videos = SEED_VIDEOS;
  if (!Array.isArray(DB.notifications)) DB.notifications = [];
  if (!DB.nextBookingSeq) DB.nextBookingSeq = 1;

  // Ensure default admin user
  const adminCreds = hashPassword('deepakhotelgroup@123');
  if (!Array.isArray(DB.admins) || DB.admins.length === 0) {
    DB.admins = [{ username: 'deepakhotelgroup', salt: adminCreds.salt, hash: adminCreds.hash }];
  } else {
    const idx = DB.admins.findIndex(a => a.username === 'deepakhotelgroup');
    if (idx >= 0) {
      DB.admins[idx] = { username: 'deepakhotelgroup', salt: adminCreds.salt, hash: adminCreds.hash };
    } else {
      DB.admins.unshift({ username: 'deepakhotelgroup', salt: adminCreds.salt, hash: adminCreds.hash });
    }
  }

  saveDb();
}

function saveDb() {
  const tmpPath = DB_PATH + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(DB, null, 2));
    fs.renameSync(tmpPath, DB_PATH);
  } catch (err) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DB, null, 2));
  }
  syncDbToSqlite();
}
loadDb();

const roomOf = id => DB.rooms.find(r => r.id === id);
const hotelOf = id => DB.hotels.find(h => h.id === id);

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

  return [
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
    `Rooms: 1`,
    ``,
    `Total Amount: ₹${total}`,
    ``,
    `Please check the admin panel for complete booking details.`
  ].join('\n');
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
  return notif;
}

/* ---------------------------------------------------------------------
   Sessions (admin auth)
--------------------------------------------------------------------- */
const SESSIONS = new Map();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
function createSession(username) {
  const token = crypto.randomBytes(24).toString('hex');
  SESSIONS.set(token, { username, expires: Date.now() + SESSION_TTL_MS });
  return token;
}
function getSession(token) {
  if (!token) return null;
  const s = SESSIONS.get(token);
  if (!s) return null;
  if (Date.now() > s.expires) { SESSIONS.delete(token); return null; }
  return s;
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
    'Content-Length': Buffer.byteLength(body)
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
  sendJson(res, 200, {
    status: 'ok',
    database: sqliteDb ? 'SQLite (data/deepak_hotels.db)' : 'JSON File Engine (data/db.json)',
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

// Authentication
route('POST', '/api/admin/login', async (req, res) => {
  let body = {};
  try { body = await readBody(req); } catch (e) { }
  const u = String(body.username || '').trim();
  const p = String(body.password || '').trim();

  if (!u || !p) {
    return sendJson(res, 401, { error: 'Username and password are required' });
  }

  const admin = (DB.admins || []).find(a => a.username === u);
  if (!admin) {
    return sendJson(res, 401, { error: 'Invalid username or password' });
  }

  const pwdValid = verifyPassword(p, admin.salt, admin.hash);
  if (!pwdValid) {
    return sendJson(res, 401, { error: 'Invalid username or password' });
  }

  const sessionUser = admin.username;
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
  try { body = await readBody(req, 15 * 1024 * 1024); } catch (e) { return sendJson(res, 400, { error: e.message }); }
  const { filename, base64 } = body;
  if (!base64 || typeof base64 !== 'string') return sendJson(res, 400, { error: 'Base64 data is required' });

  const match = base64.match(/^data:([^;]+);base64,(.+)$/);
  let ext = '.png';
  let buffer;

  if (match) {
    const mime = match[1];
    if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
    else if (mime.includes('png')) ext = '.png';
    else if (mime.includes('gif')) ext = '.gif';
    else if (mime.includes('webp')) ext = '.webp';
    else if (mime.includes('mp4')) ext = '.mp4';
    else if (mime.includes('webm')) ext = '.webm';
    buffer = Buffer.from(match[2], 'base64');
  } else {
    buffer = Buffer.from(base64, 'base64');
  }

  const safeName = (filename ? path.parse(filename).name.replace(/[^a-z0-9_-]/gi, '_') : 'file') + '_' + Date.now() + ext;
  const savePath = path.join(UPLOADS_DIR, safeName);

  try {
    fs.writeFileSync(savePath, buffer);
    const url = '/uploads/' + safeName;
    sendJson(res, 200, { ok: true, url, filename: safeName });
  } catch (err) {
    sendJson(res, 500, { error: 'Failed to write file to disk: ' + err.message });
  }
});

// Notifications API
route('GET', '/api/notifications', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  sendJson(res, 200, { notifications: DB.notifications || [] });
});

route('GET', '/api/notifications/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const n = DB.notifications.find(x => x.id === params.id);
  if (!n) return sendJson(res, 404, { error: 'Notification record not found' });
  sendJson(res, 200, { notification: n });
});

route('POST', '/api/notifications/:id/retry', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const n = DB.notifications.find(x => x.id === params.id);
  if (!n) return sendJson(res, 404, { error: 'Notification record not found' });

  await dispatchNotification(n);
  saveDb();
  sendJson(res, 200, { ok: true, notification: n });
});

// Website Settings
route('GET', '/api/settings', async (req, res) => {
  sendJson(res, 200, { settings: DB.settings });
});

route('PATCH', '/api/settings', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  Object.assign(DB.settings, body);
  saveDb();
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
  saveDb();
  sendJson(res, 200, { ok: true, hero: DB.hero });
});

// Hotels / Properties
route('GET', '/api/hotels', async (req, res) => {
  sendJson(res, 200, { hotels: DB.hotels });
});

route('POST', '/api/hotels', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await readBody(req);
  const { name, tag, locality, phone, accent, image, desc } = body;
  if (!name) return sendJson(res, 400, { error: 'Hotel name is required' });
  
  const id = body.id || genUniqueId('hotel');
  if (DB.hotels.some(h => h.id === id)) return sendJson(res, 400, { error: 'Hotel ID already exists' });

  const hotel = {
    id,
    name: String(name).trim(),
    tag: String(tag || '').trim(),
    locality: String(locality || '').trim(),
    phone: String(phone || '').trim(),
    accent: String(accent || '#E8A33D').trim(),
    image: String(image || '/images/hero-bg.jpg'),
    desc: String(desc || '').trim()
  };

  DB.hotels.push(hotel);
  saveDb();
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
  saveDb();
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
  saveDb();
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
  saveDb();
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
  updates.forEach(u => {
    const r = DB.rooms.find(rm => rm.id === u.roomId);
    if (!r) return;
    if (Number.isFinite(u.price24)) r.price24 = Math.max(0, Math.round(u.price24));
    if (Number.isFinite(u.price6)) r.price6 = Math.max(0, Math.round(u.price6));
    if (typeof u.ac === 'boolean') r.ac = u.ac;
    if (typeof u.cat === 'string' && ROOM_CATEGORIES.includes(u.cat)) r.cat = u.cat;
    applied.push(r.id);
  });
  saveDb();
  sendJson(res, 200, { ok: true, updated: applied });
});

route('PATCH', '/api/rooms/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const r = roomOf(params.id);
  if (!r) return sendJson(res, 404, { error: 'Room not found' });
  let body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 413, { error: e.message }); }
  if (Number.isFinite(body.price24)) r.price24 = Math.max(0, Math.round(body.price24));
  if (Number.isFinite(body.price6)) r.price6 = Math.max(0, Math.round(body.price6));
  if (typeof body.ac === 'boolean') r.ac = body.ac;
  if (typeof body.cat === 'string') {
    if (!ROOM_CATEGORIES.includes(body.cat)) return sendJson(res, 400, { error: 'Invalid category' });
    r.cat = body.cat;
  }
  if (typeof body.photo === 'string') {
    r.photo = body.photo;
  } else if (body.photo === null) {
    r.photo = null;
  }
  if (body.maxGuests !== undefined) r.maxGuests = Number(body.maxGuests) || 2;
  if (body.bedType !== undefined) r.bedType = String(body.bedType);
  if (body.amenities !== undefined) r.amenities = String(body.amenities);
  if (body.status !== undefined) r.status = String(body.status);
  if (body.desc !== undefined) r.desc = String(body.desc);
  if (body.video_url !== undefined) r.video_url = String(body.video_url);
  if (body.discount_price !== undefined || body.discountPrice !== undefined) r.discount_price = Number(body.discount_price || body.discountPrice) || 0;

  saveDb();
  sendJson(res, 200, { ok: true, room: r });
});

route('POST', '/api/rooms', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  let body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
  const { hotel, num, floor, ac, cat, price24, price6, photo, maxGuests, bedType, amenities, status } = body;
  if (!hotel || !hotelOf(hotel)) return sendJson(res, 400, { error: 'Invalid hotel' });
  if (!num || (typeof num !== 'string' && typeof num !== 'number')) return sendJson(res, 400, { error: 'Room number is required' });
  const strNum = String(num).trim();
  const roomId = hotel + '-' + strNum;
  if (DB.rooms.some(r => r.id === roomId)) return sendJson(res, 400, { error: `Room ${strNum} already exists for this hotel` });
  if (!ROOM_CATEGORIES.includes(cat)) return sendJson(res, 400, { error: 'Invalid room category' });

  const newRoom = {
    id: roomId,
    hotel,
    num: strNum,
    floor: Number(floor) || 1,
    ac: Boolean(ac),
    cat,
    price24: Math.max(0, Math.round(Number(price24) || 0)),
    price6: Math.max(0, Math.round(Number(price6) || 0)),
    photo: typeof photo === 'string' ? photo : null,
    maxGuests: Number(maxGuests) || 2,
    bedType: String(bedType || 'King Bed'),
    amenities: String(amenities || 'Wi-Fi, AC, TV'),
    status: String(status || 'available'),
    desc: String(body.desc || ''),
    video_url: String(body.video_url || ''),
    discount_price: Number(body.discount_price || body.discountPrice) || 0
  };
  DB.rooms.push(newRoom);
  saveDb();
  sendJson(res, 201, { ok: true, room: newRoom });
});

route('DELETE', '/api/rooms/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const idx = DB.rooms.findIndex(r => r.id === params.id);
  if (idx === -1) return sendJson(res, 404, { error: 'Room not found' });
  DB.rooms.splice(idx, 1);
  if (sqliteDb) {
    try { sqliteDb.prepare('DELETE FROM rooms WHERE id = ?').run(params.id); } catch (e) { }
  }
  saveDb();
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
  sendJson(res, 200, { menu: groupedMenu(items) });
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
  saveDb();
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
  saveDb();
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
  saveDb();
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
  saveDb();
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
  saveDb();
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
  saveDb();
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
  }
  DB.videos.push(video);
  saveDb();
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
    if (v.is_homepage) DB.videos.forEach(other => { if (other.id !== v.id) other.is_homepage = false; });
  }
  if (typeof body.is_active === 'boolean') v.is_active = body.is_active;
  saveDb();
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
  saveDb();
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
  saveDb();
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
  saveDb();
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
  saveDb();
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
  saveDb();
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
  saveDb();
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
  saveDb();
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
  saveDb();
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
  saveDb();
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
  saveDb();
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
  if (!['upload', 'hotel'].includes(body.idMethod)) return sendJson(res, 400, { error: 'Invalid idMethod' });
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
  saveDb();

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
  saveDb();
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
  saveDb();
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
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm'
};

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html'
    : pathname === '/admin' ? '/admin.html'
      : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ---------------------------------------------------------------------
   Server Initialization
--------------------------------------------------------------------- */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  if (u.pathname.startsWith('/api/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.regex.exec(u.pathname);
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
  if (req.method === 'GET') return serveStatic(req, res, u.pathname);
  res.writeHead(405); res.end('Method not allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`Deepak Hotels Group server running on http://${HOST}:${PORT}`);
  console.log(`  Customer site: http://localhost:${PORT}/`);
  console.log(`  Admin dashboard: http://localhost:${PORT}/admin`);
  console.log(`  Admin notification mobile: ${ADMIN_MOBILE}`);
});

function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}, saving data and shutting down gracefully...`);
  try { if (typeof saveDb === 'function') saveDb(); } catch (e) { console.error('Error saving DB:', e); }
  server.close(() => {
    process.exit(0);
  });
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
