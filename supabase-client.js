/* =========================================================================
   DEEPAK HOTELS GROUP — Supabase Cloud Database Client Engine
   Dual-engine sync adapter connecting all sections of Deepak Hotels Group:
   Hotels, Rooms, Bookings, Dining Menu, Settings, Hero, Amenities, Offers,
   Reviews, Gallery, Videos, and Notifications.
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'supabase_config.json');
const ENV_FILE = path.join(ROOT, '.env');

let supabaseClient = null;
let activeConfig = {
  url: '',
  key: '',
  anonKey: ''
};

function readConfigFile() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (data && typeof data === 'object') return data;
    }
  } catch (err) {
    console.error('[Supabase] Error reading config file:', err.message);
  }
  return {};
}

function resolveConfig() {
  const fileConfig = readConfigFile();
  const url = (process.env.SUPABASE_URL || fileConfig.supabase_url || fileConfig.url || '').trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    fileConfig.supabase_service_role_key ||
    fileConfig.supabase_key ||
    fileConfig.key ||
    process.env.SUPABASE_ANON_KEY ||
    fileConfig.supabase_anon_key ||
    ''
  ).trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || fileConfig.supabase_anon_key || fileConfig.anonKey || '').trim();

  return { url, key, anonKey };
}

function initSupabase(customConfig = null) {
  const config = customConfig || resolveConfig();
  activeConfig = config;

  if (config.url && config.key) {
    try {
      supabaseClient = createClient(config.url, config.key, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      console.log(`[Supabase] Client initialized for project: ${config.url}`);
      return true;
    } catch (err) {
      console.error('[Supabase] Initialization error:', err.message);
      supabaseClient = null;
      return false;
    }
  } else {
    supabaseClient = null;
    return false;
  }
}

// Initial initialization attempt
initSupabase();

function getClient() {
  return supabaseClient;
}

function isConfigured() {
  return Boolean(activeConfig.url && activeConfig.key && supabaseClient);
}

async function testConnection(customUrl = null, customKey = null) {
  const url = customUrl || activeConfig.url;
  const key = customKey || activeConfig.key;

  if (!url || !key) {
    return { ok: false, error: 'Supabase URL and API Key must both be provided' };
  }

  try {
    const testClient = createClient(url, key, { auth: { persistSession: false } });
    const start = Date.now();
    const { data, error } = await testClient.from('hotels').select('id, name').limit(1);
    const latency = Date.now() - start;

    if (error) {
      // If table doesn't exist, try testing with generic auth or check error message
      if (error.message && error.message.includes('relation "hotels" does not exist')) {
        return {
          ok: true,
          connected: true,
          tablesMissing: true,
          latencyMs: latency,
          message: 'Connected to Supabase project, but tables are not yet created. Please run the supabase_schema.sql script in the Supabase SQL Editor.'
        };
      }
      return { ok: false, error: error.message, code: error.code };
    }

    return {
      ok: true,
      connected: true,
      latencyMs: latency,
      message: `Successfully connected to Supabase (${latency}ms)`
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function getStatus() {
  const config = resolveConfig();
  if (!config.url || !config.key) {
    return {
      isConfigured: false,
      isConnected: false,
      activeEngine: 'Local SQLite Engine (Dual-sync)',
      url: '',
      anonKey: config.anonKey || '',
      tableStats: {},
      message: 'Supabase is not configured yet. Running on high-performance local SQLite database.'
    };
  }

  const test = await testConnection();
  if (!test.ok) {
    return {
      isConfigured: true,
      isConnected: false,
      activeEngine: 'Local SQLite (Fallback mode)',
      url: config.url,
      anonKey: config.anonKey || '',
      error: test.error,
      tableStats: {},
      message: `Supabase configuration detected, but connection failed: ${test.error}`
    };
  }

  // Count rows in Supabase tables
  const tables = [
    'hotels', 'rooms', 'menu_items', 'bookings', 'website_settings',
    'hero_settings', 'amenities', 'offers', 'reviews', 'gallery', 'videos', 'notifications'
  ];

  const tableStats = {};
  if (!test.tablesMissing && supabaseClient) {
    await Promise.all(
      tables.map(async tbl => {
        try {
          const { count, error } = await supabaseClient.from(tbl).select('*', { count: 'exact', head: true });
          tableStats[tbl] = error ? 0 : (count || 0);
        } catch (e) {
          tableStats[tbl] = 0;
        }
      })
    );
  }

  return {
    isConfigured: true,
    isConnected: true,
    tablesMissing: Boolean(test.tablesMissing),
    latencyMs: test.latencyMs,
    activeEngine: 'Supabase Cloud PostgreSQL Engine',
    url: config.url,
    anonKey: config.anonKey || '',
    tableStats,
    message: test.message
  };
}

function saveConfig(newConfig) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { }

  const current = readConfigFile();
  const updated = {
    ...current,
    supabase_url: (newConfig.url || newConfig.supabase_url || '').trim(),
    supabase_key: (newConfig.key || newConfig.supabase_key || newConfig.supabase_service_role_key || '').trim(),
    supabase_anon_key: (newConfig.anonKey || newConfig.supabase_anon_key || '').trim(),
    updated_at: new Date().toISOString()
  };

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
  } catch (e) {
    // Read-only filesystem in serverless
  }

  // Also update or create .env file for environment persistence
  try {
    let envContent = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
    function setEnvVar(name, val) {
      const regex = new RegExp(`^${name}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${name}=${val}`);
      } else {
        envContent += `\n${name}=${val}`;
      }
    }
    if (updated.supabase_url) setEnvVar('SUPABASE_URL', updated.supabase_url);
    if (updated.supabase_key) setEnvVar('SUPABASE_SERVICE_ROLE_KEY', updated.supabase_key);
    if (updated.supabase_anon_key) setEnvVar('SUPABASE_ANON_KEY', updated.supabase_anon_key);
    fs.writeFileSync(ENV_FILE, envContent.trim() + '\n');
  } catch (e) {
    console.error('[Supabase] Note: could not write to .env:', e.message);
  }

  initSupabase({
    url: updated.supabase_url,
    key: updated.supabase_key,
    anonKey: updated.supabase_anon_key
  });

  return { ok: true, config: { url: updated.supabase_url, anonKey: updated.supabase_anon_key } };
}

/* ---------------------------------------------------------------------
   SECTION-BY-SECTION ENTITY SYNC (NON-BLOCKING BACKGROUND DISPATCH)
--------------------------------------------------------------------- */

// 1. Properties / Hotels
async function syncHotel(hotel, action = 'upsert') {
  if (!supabaseClient) return;
  try {
    if (action === 'delete') {
      await supabaseClient.from('hotels').delete().eq('id', hotel.id);
    } else {
      await supabaseClient.from('hotels').upsert({
        id: hotel.id,
        name: hotel.name,
        tag: hotel.tag || '',
        locality: hotel.locality || '',
        phone: hotel.phone || '',
        accent: hotel.accent || '#E8A33D',
        image: hotel.image || '/images/hero-bg.jpg',
        desc: hotel.desc || '',
        exact_location: hotel.exact_location || '',
        map_url: hotel.map_url || '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }
  } catch (err) {
    console.error('[Supabase Sync] Hotel error:', err.message);
  }
}

// 2. Rooms Inventory
async function syncRoom(room, action = 'upsert') {
  if (!supabaseClient) return;
  try {
    if (action === 'delete') {
      await supabaseClient.from('rooms').delete().eq('id', room.id);
    } else {
      await supabaseClient.from('rooms').upsert({
        id: room.id,
        hotel: room.hotel,
        num: String(room.num),
        floor: Number(room.floor) || 1,
        ac: Boolean(room.ac),
        cat: room.cat,
        price24: Number(room.price24) || 0,
        price6: Number(room.price6) || 0,
        photo: room.photo || null,
        max_guests: Number(room.maxGuests) || 2,
        bed_type: room.bedType || 'King Bed',
        amenities: room.amenities || 'Wi-Fi, AC, TV',
        status: room.status || 'available',
        desc: room.desc || '',
        video_url: room.video_url || '',
        discount_price: Number(room.discount_price) || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }
  } catch (err) {
    console.error('[Supabase Sync] Room error:', err.message);
  }
}

// 3. Dining Menu Items
async function syncMenuItem(item, action = 'upsert') {
  if (!supabaseClient) return;
  try {
    if (action === 'delete') {
      await supabaseClient.from('menu_items').delete().eq('id', item.id);
    } else {
      await supabaseClient.from('menu_items').upsert({
        id: item.id,
        name: item.name,
        category: item.category || 'Other',
        price: Number(item.price) || 0,
        photo: item.photo || null,
        available: Boolean(item.available),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }
  } catch (err) {
    console.error('[Supabase Sync] Menu item error:', err.message);
  }
}

// 4. Bookings
async function syncBooking(b, action = 'upsert') {
  if (!supabaseClient) return;
  try {
    if (action === 'delete') {
      await supabaseClient.from('bookings').delete().eq('id', b.id);
    } else {
      await supabaseClient.from('bookings').upsert({
        id: b.id,
        hotel_room: b.hotelRoom,
        name: b.name,
        phone: b.phone,
        email: b.email || null,
        guests: Number(b.guests) || 1,
        stay: b.stay,
        date: b.date,
        time: b.time,
        id_method: b.idMethod || 'hotel',
        id_photo_base64: b.idPhotoBase64 || null,
        requests: b.requests || '',
        food: Array.isArray(b.food) ? b.food : [],
        status: b.status || 'pending',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }
  } catch (err) {
    console.error('[Supabase Sync] Booking error:', err.message);
  }
}

// 5. Global Website Settings
async function syncSettings(settings) {
  if (!supabaseClient) return;
  try {
    const entries = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString()
    }));
    await supabaseClient.from('website_settings').upsert(entries, { onConflict: 'key' });
  } catch (err) {
    console.error('[Supabase Sync] Settings error:', err.message);
  }
}

// 6. Hero Banner Settings
async function syncHero(hero) {
  if (!supabaseClient) return;
  try {
    const entries = Object.entries(hero).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString()
    }));
    await supabaseClient.from('hero_settings').upsert(entries, { onConflict: 'key' });
  } catch (err) {
    console.error('[Supabase Sync] Hero settings error:', err.message);
  }
}

// 7. Amenities
async function syncAmenity(amenity, action = 'upsert') {
  if (!supabaseClient) return;
  try {
    if (action === 'delete') {
      await supabaseClient.from('amenities').delete().eq('id', amenity.id);
    } else {
      await supabaseClient.from('amenities').upsert({
        id: amenity.id,
        name: amenity.name,
        icon: amenity.icon || 'sparkles',
        category: amenity.category || 'General',
        desc: amenity.desc || ''
      }, { onConflict: 'id' });
    }
  } catch (err) {
    console.error('[Supabase Sync] Amenity error:', err.message);
  }
}

// 8. Offers & Promo Deals
async function syncOffer(offer, action = 'upsert') {
  if (!supabaseClient) return;
  try {
    if (action === 'delete') {
      await supabaseClient.from('offers').delete().eq('id', offer.id);
    } else {
      await supabaseClient.from('offers').upsert({
        id: offer.id,
        title: offer.title,
        desc: offer.desc || '',
        discount: offer.discount || '',
        image: offer.image || '',
        valid_from: offer.valid_from || '',
        valid_to: offer.valid_to || '',
        code: offer.code || '',
        is_active: Boolean(offer.is_active)
      }, { onConflict: 'id' });
    }
  } catch (err) {
    console.error('[Supabase Sync] Offer error:', err.message);
  }
}

// 9. Customer Reviews
async function syncReview(review, action = 'upsert') {
  if (!supabaseClient) return;
  try {
    if (action === 'delete') {
      await supabaseClient.from('reviews').delete().eq('id', review.id);
    } else {
      await supabaseClient.from('reviews').upsert({
        id: review.id,
        guest_name: review.guest_name,
        rating: Number(review.rating) || 5,
        review_text: review.review_text,
        guest_image: review.guest_image || '',
        hotel_tag: review.hotel_tag || 'Deepak Hotels Group'
      }, { onConflict: 'id' });
    }
  } catch (err) {
    console.error('[Supabase Sync] Review error:', err.message);
  }
}

// 10. Photo Gallery
async function syncGallery(item, action = 'upsert') {
  if (!supabaseClient) return;
  try {
    if (action === 'delete') {
      await supabaseClient.from('gallery').delete().eq('id', item.id);
    } else {
      await supabaseClient.from('gallery').upsert({
        id: item.id,
        title: item.title || '',
        category: item.category || 'General',
        image: item.image,
        display_order: Number(item.display_order) || 0
      }, { onConflict: 'id' });
    }
  } catch (err) {
    console.error('[Supabase Sync] Gallery error:', err.message);
  }
}

// 11. Hotel Videos
async function syncVideo(video, action = 'upsert') {
  if (!supabaseClient) return;
  try {
    if (action === 'delete') {
      await supabaseClient.from('videos').delete().eq('id', video.id);
    } else {
      await supabaseClient.from('videos').upsert({
        id: video.id,
        title: video.title,
        video_url: video.video_url,
        is_homepage: Boolean(video.is_homepage),
        is_active: Boolean(video.is_active)
      }, { onConflict: 'id' });
    }
  } catch (err) {
    console.error('[Supabase Sync] Video error:', err.message);
  }
}

// 12. Notification Logs
async function syncNotification(notif) {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('notifications').upsert({
      id: notif.id,
      booking_id: notif.booking_id || null,
      recipient_number: notif.recipient_number || notif.recipient || '',
      notification_type: notif.notification_type || 'sms',
      message: notif.message,
      status: notif.status || 'pending',
      provider_message_id: notif.provider_message_id || null,
      error_message: notif.error_message || null,
      attempts: Number(notif.attempts) || 1,
      sent_at: notif.sent_at || null
    }, { onConflict: 'id' });
  } catch (err) {
    console.error('[Supabase Sync] Notification error:', err.message);
  }
}

// 13. Admin Auth Credentials
async function syncAdmin(admin) {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('admins').upsert({
      username: admin.username,
      salt: admin.salt,
      hash: admin.hash
    }, { onConflict: 'username' });
  } catch (err) {
    console.error('[Supabase Sync] Admin credential error:', err.message);
  }
}

/* ---------------------------------------------------------------------
   BULK FULL MIGRATION & SYNC UTILITIES
--------------------------------------------------------------------- */

// Pushes all local memory DB items to Supabase tables
async function pushAllToSupabase(DB) {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured or connected');
  }

  if (!DB) {
    try {
      const dbPath = path.join(__dirname, 'data', 'db.json');
      if (fs.existsSync(dbPath)) {
        DB = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      }
    } catch (e) {
      console.error('[Supabase Bulk] Could not load DB fallback:', e.message);
    }
  }
  DB = DB || {};

  const results = {
    hotels: 0,
    rooms: 0,
    menu_items: 0,
    bookings: 0,
    settings: 0,
    hero: 0,
    amenities: 0,
    offers: 0,
    reviews: 0,
    gallery: 0,
    videos: 0,
    notifications: 0,
    admins: 0
  };

  // 1. Hotels
  if (DB.hotels && DB.hotels.length) {
    const hotelRows = DB.hotels.map(h => ({
      id: h.id,
      name: h.name,
      tag: h.tag || '',
      locality: h.locality || '',
      phone: h.phone || '',
      accent: h.accent || '#E8A33D',
      image: h.image || '/images/hero-bg.jpg',
      desc: h.desc || '',
      exact_location: h.exact_location || '',
      map_url: h.map_url || '',
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabaseClient.from('hotels').upsert(hotelRows, { onConflict: 'id' });
    if (!error) results.hotels = hotelRows.length;
    else console.error('[Supabase Bulk] Hotels error:', error.message);
  }

  // 2. Rooms
  if (DB.rooms && DB.rooms.length) {
    const roomRows = DB.rooms.map(r => ({
      id: r.id,
      hotel: r.hotel,
      num: String(r.num),
      floor: Number(r.floor) || 1,
      ac: Boolean(r.ac),
      cat: r.cat,
      price24: Number(r.price24) || 0,
      price6: Number(r.price6) || 0,
      photo: r.photo || null,
      max_guests: Number(r.maxGuests) || 2,
      bed_type: r.bedType || 'King Bed',
      amenities: r.amenities || 'Wi-Fi, AC, TV',
      status: r.status || 'available',
      desc: r.desc || '',
      video_url: r.video_url || '',
      discount_price: Number(r.discount_price) || 0,
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabaseClient.from('rooms').upsert(roomRows, { onConflict: 'id' });
    if (!error) results.rooms = roomRows.length;
    else console.error('[Supabase Bulk] Rooms error:', error.message);
  }

  // 3. Menu items
  if (DB.menuItems && DB.menuItems.length) {
    const menuRows = DB.menuItems.map(m => ({
      id: m.id,
      name: m.name,
      category: m.category || 'Other',
      price: Number(m.price) || 0,
      photo: m.photo || null,
      available: Boolean(m.available),
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabaseClient.from('menu_items').upsert(menuRows, { onConflict: 'id' });
    if (!error) results.menu_items = menuRows.length;
    else console.error('[Supabase Bulk] Menu error:', error.message);
  }

  // 4. Bookings
  if (DB.bookings && DB.bookings.length) {
    const bookingRows = DB.bookings.map(b => ({
      id: b.id,
      hotel_room: b.hotelRoom,
      name: b.name,
      phone: b.phone,
      email: b.email || null,
      guests: Number(b.guests) || 1,
      stay: b.stay,
      date: b.date,
      time: b.time,
      id_method: b.idMethod || 'hotel',
      id_photo_base64: b.idPhotoBase64 || null,
      requests: b.requests || '',
      food: Array.isArray(b.food) ? b.food : [],
      status: b.status || 'pending',
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabaseClient.from('bookings').upsert(bookingRows, { onConflict: 'id' });
    if (!error) results.bookings = bookingRows.length;
    else console.error('[Supabase Bulk] Bookings error:', error.message);
  }

  // 5. Settings
  if (DB.settings) {
    const settingRows = Object.entries(DB.settings).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabaseClient.from('website_settings').upsert(settingRows, { onConflict: 'key' });
    if (!error) results.settings = settingRows.length;
  }

  // 6. Hero
  if (DB.hero) {
    const heroRows = Object.entries(DB.hero).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabaseClient.from('hero_settings').upsert(heroRows, { onConflict: 'key' });
    if (!error) results.hero = heroRows.length;
  }

  // 7. Amenities
  if (DB.amenities && DB.amenities.length) {
    const amenityRows = DB.amenities.map(a => ({
      id: a.id,
      name: a.name,
      icon: a.icon || 'sparkles',
      category: a.category || 'General',
      desc: a.desc || ''
    }));
    const { error } = await supabaseClient.from('amenities').upsert(amenityRows, { onConflict: 'id' });
    if (!error) results.amenities = amenityRows.length;
  }

  // 8. Offers
  if (DB.offers && DB.offers.length) {
    const offerRows = DB.offers.map(o => ({
      id: o.id,
      title: o.title,
      desc: o.desc || '',
      discount: o.discount || '',
      image: o.image || '',
      valid_from: o.valid_from || '',
      valid_to: o.valid_to || '',
      code: o.code || '',
      is_active: Boolean(o.is_active)
    }));
    const { error } = await supabaseClient.from('offers').upsert(offerRows, { onConflict: 'id' });
    if (!error) results.offers = offerRows.length;
  }

  // 9. Reviews
  if (DB.reviews && DB.reviews.length) {
    const reviewRows = DB.reviews.map(r => ({
      id: r.id,
      guest_name: r.guest_name,
      rating: Number(r.rating) || 5,
      review_text: r.review_text,
      guest_image: r.guest_image || '',
      hotel_tag: r.hotel_tag || 'Deepak Hotels Group'
    }));
    const { error } = await supabaseClient.from('reviews').upsert(reviewRows, { onConflict: 'id' });
    if (!error) results.reviews = reviewRows.length;
  }

  // 10. Gallery
  if (DB.gallery && DB.gallery.length) {
    const galleryRows = DB.gallery.map(g => ({
      id: g.id,
      title: g.title || '',
      category: g.category || 'General',
      image: g.image,
      display_order: Number(g.display_order) || 0
    }));
    const { error } = await supabaseClient.from('gallery').upsert(galleryRows, { onConflict: 'id' });
    if (!error) results.gallery = galleryRows.length;
  }

  // 11. Videos
  if (DB.videos && DB.videos.length) {
    const videoRows = DB.videos.map(v => ({
      id: v.id,
      title: v.title,
      video_url: v.video_url,
      is_homepage: Boolean(v.is_homepage),
      is_active: Boolean(v.is_active)
    }));
    const { error } = await supabaseClient.from('videos').upsert(videoRows, { onConflict: 'id' });
    if (!error) results.videos = videoRows.length;
  }

  // 12. Notifications
  if (DB.notifications && DB.notifications.length) {
    const notifRows = DB.notifications.map(n => ({
      id: n.id,
      booking_id: n.booking_id || null,
      recipient_number: n.recipient_number || n.recipient || '',
      notification_type: n.notification_type || 'sms',
      message: n.message,
      status: n.status || 'pending',
      provider_message_id: n.provider_message_id || null,
      error_message: n.error_message || null,
      attempts: Number(n.attempts) || 1
    }));
    const { error } = await supabaseClient.from('notifications').upsert(notifRows, { onConflict: 'id' });
    if (!error) results.notifications = notifRows.length;
  }

  // 13. Admins
  if (DB.admins && DB.admins.length) {
    const adminRows = DB.admins.map(a => ({
      username: a.username,
      salt: a.salt,
      hash: a.hash
    }));
    const { error } = await supabaseClient.from('admins').upsert(adminRows, { onConflict: 'username' });
    if (!error) results.admins = adminRows.length;
  }

  return { ok: true, results };
}

// Pulls remote data from Supabase and converts to local schema format
async function pullAllFromSupabase() {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured or connected');
  }

  const [
    hotelsRes, roomsRes, menuRes, bookingsRes, settingsRes,
    heroRes, amenitiesRes, offersRes, reviewsRes, galleryRes, videosRes, notifsRes
  ] = await Promise.all([
    supabaseClient.from('hotels').select('*'),
    supabaseClient.from('rooms').select('*'),
    supabaseClient.from('menu_items').select('*'),
    supabaseClient.from('bookings').select('*'),
    supabaseClient.from('website_settings').select('*'),
    supabaseClient.from('hero_settings').select('*'),
    supabaseClient.from('amenities').select('*'),
    supabaseClient.from('offers').select('*'),
    supabaseClient.from('reviews').select('*'),
    supabaseClient.from('gallery').select('*').order('display_order', { ascending: true }),
    supabaseClient.from('videos').select('*'),
    supabaseClient.from('notifications').select('*')
  ]);

  const settingsObj = {};
  if (settingsRes.data) settingsRes.data.forEach(s => { settingsObj[s.key] = s.value; });

  const heroObj = {};
  if (heroRes.data) heroRes.data.forEach(h => { heroObj[h.key] = h.value; });

  return {
    hotels: (hotelsRes.data || []).map(h => ({
      id: h.id,
      name: h.name,
      tag: h.tag,
      locality: h.locality,
      phone: h.phone,
      accent: h.accent,
      image: h.image,
      desc: h.desc,
      exact_location: h.exact_location || '',
      map_url: h.map_url || ''
    })),
    rooms: (roomsRes.data || []).map(r => ({
      id: r.id,
      hotel: r.hotel,
      num: String(r.num),
      floor: Number(r.floor) || 1,
      ac: Boolean(r.ac),
      cat: r.cat,
      price24: Number(r.price24) || 0,
      price6: Number(r.price6) || 0,
      photo: r.photo || null,
      maxGuests: Number(r.max_guests) || 2,
      bedType: r.bed_type || 'King Bed',
      amenities: r.amenities || 'Wi-Fi, AC, TV',
      status: r.status || 'available',
      desc: r.desc || '',
      video_url: r.video_url || '',
      discount_price: Number(r.discount_price) || 0
    })),
    menuItems: (menuRes.data || []).map(m => ({
      id: m.id,
      name: m.name,
      category: m.category,
      price: Number(m.price) || 0,
      photo: m.photo || null,
      available: Boolean(m.available)
    })),
    bookings: (bookingsRes.data || []).map(b => ({
      id: b.id,
      hotelRoom: b.hotel_room,
      name: b.name,
      phone: b.phone,
      email: b.email,
      guests: Number(b.guests) || 1,
      stay: b.stay,
      date: b.date,
      time: b.time,
      idMethod: b.id_method || 'hotel',
      idPhotoBase64: b.id_photo_base64 || null,
      requests: b.requests || '',
      food: Array.isArray(b.food) ? b.food : [],
      status: b.status || 'pending',
      createdAt: b.created_at
    })),
    settings: settingsObj,
    hero: heroObj,
    amenities: (amenitiesRes.data || []).map(a => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      category: a.category,
      desc: a.desc
    })),
    offers: (offersRes.data || []).map(o => ({
      id: o.id,
      title: o.title,
      desc: o.desc,
      discount: o.discount,
      image: o.image,
      valid_from: o.valid_from,
      valid_to: o.valid_to,
      code: o.code,
      is_active: Boolean(o.is_active)
    })),
    reviews: (reviewsRes.data || []).map(r => ({
      id: r.id,
      guest_name: r.guest_name,
      rating: Number(r.rating) || 5,
      review_text: r.review_text,
      guest_image: r.guest_image,
      hotel_tag: r.hotel_tag
    })),
    gallery: (galleryRes.data || []).map(g => ({
      id: g.id,
      title: g.title,
      category: g.category,
      image: g.image,
      display_order: Number(g.display_order) || 0
    })),
    videos: (videosRes.data || []).map(v => ({
      id: v.id,
      title: v.title,
      video_url: v.video_url,
      is_homepage: Boolean(v.is_homepage),
      is_active: Boolean(v.is_active)
    })),
    notifications: (notifsRes.data || []).map(n => ({
      id: n.id,
      booking_id: n.booking_id,
      recipient_number: n.recipient_number,
      notification_type: n.notification_type,
      message: n.message,
      status: n.status,
      provider_message_id: n.provider_message_id,
      error_message: n.error_message,
      attempts: Number(n.attempts) || 1,
      created_at: n.created_at,
      sent_at: n.sent_at
    }))
  };
}

module.exports = {
  getClient,
  isConfigured,
  initSupabase,
  testConnection,
  getStatus,
  saveConfig,
  syncHotel,
  syncRoom,
  syncMenuItem,
  syncBooking,
  syncSettings,
  syncHero,
  syncAmenity,
  syncOffer,
  syncReview,
  syncGallery,
  syncVideo,
  syncNotification,
  syncAdmin,
  pushAllToSupabase,
  pullAllFromSupabase
};
