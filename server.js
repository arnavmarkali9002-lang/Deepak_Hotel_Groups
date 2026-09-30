/* =========================================================================
   DEEPAK HOTELS GROUP — backend
   Zero-dependency Node.js HTTP server + a JSON-file database (data/db.json).
   Serves /public (customer site + admin dashboard) and a REST API that both
   pages talk to, so bookings made on the customer site show up live in the
   admin dashboard and vice versa.
   Run:  node server.js          (defaults to PORT 3000)
   ========================================================================= */
'use strict';
const http = require('http');
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

/* ---------------------------------------------------------------------
   SEED DATA — used only the very first time db.json doesn't exist yet.
   After that, everything lives in data/db.json and this is never re-read.
--------------------------------------------------------------------- */
const SEED_HOTELS = [
  { id: 'sv1', name: 'Hotel Sai View',   tag: 'The Original',    locality: 'Station Road, near Bus Stand',        phone: '+91 98765 43210', accent: '#E8A33D', image: '/images/hotel-sai-view.jpg', desc: 'Our flagship property with 11 rooms across single, couple, family and suite categories.' },
  { id: 'sv2', name: 'Hotel Sai Santosh', tag: 'The Family Wing', locality: 'Market Yard Road',                     phone: '+91 98765 43211', accent: '#2F6E62', image: '/images/hotel-sai-santosh.jpg', desc: 'A quieter property popular with families, 10 rooms with a bigger courtyard and parking.' },
  { id: 'sv3', name: 'Hotel Om Sai',     tag: 'The Highway Stop', locality: 'Highway Junction, opp. Petrol Pump',   phone: '+91 98765 43212', accent: '#7C2D2D', image: '/images/hotel-om-sai.jpg', desc: 'Convenient for travellers passing through, 10 rooms with easy parking and quick check-in.' }
];
const SEED_ROOMS_RAW = [
  ['sv1','101',1,false,'Single',1200,700], ['sv1','102',1,false,'Single',1200,700], ['sv1','103',1,true,'Single',1800,1000],
  ['sv1','104',1,false,'Couple',1500,900], ['sv1','105',1,true,'Couple',2200,1300], ['sv1','201',2,false,'Couple',1500,900],
  ['sv1','202',2,true,'Couple',2200,1300], ['sv1','203',2,false,'Family',2200,1300], ['sv1','204',2,true,'Family',3000,1800],
  ['sv1','205',2,true,'Family',3000,1800], ['sv1','301',3,true,'Suite',4000,2400],
  ['sv2','201',1,false,'Single',1100,650], ['sv2','202',1,true,'Single',1700,950], ['sv2','203',1,false,'Couple',1450,850],
  ['sv2','204',1,true,'Couple',2100,1250], ['sv2','205',1,false,'Couple',1450,850], ['sv2','301',2,true,'Family',2900,1750],
  ['sv2','302',2,false,'Family',2100,1250], ['sv2','303',2,true,'Family',2900,1750], ['sv2','304',2,true,'Couple',2100,1250],
  ['sv2','305',2,true,'Suite',3800,2300],
  ['sv3','301',1,false,'Single',1100,650], ['sv3','302',1,false,'Single',1100,650], ['sv3','303',1,true,'Couple',2100,1250],
  ['sv3','304',1,false,'Couple',1450,850], ['sv3','305',1,true,'Couple',2100,1250], ['sv3','401',2,false,'Family',2100,1250],
  ['sv3','402',2,true,'Family',2900,1750], ['sv3','403',2,true,'Family',2900,1750], ['sv3','404',2,false,'Couple',1450,850],
  ['sv3','405',2,true,'Suite',3800,2300]
];
const SEED_ROOMS = SEED_ROOMS_RAW.map(([hotel,num,floor,ac,cat,price24,price6]) => ({
  id: hotel + '-' + num, hotel, num, floor, ac, cat, price24, price6, photo: null
}));
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
    menuItems: [],         // starts EMPTY — the admin adds dishes from the Food Orders panel
    bookings: [],          // starts EMPTY — no fake bookings, ever
    admins: [{ username: 'deepakhotelgroup', salt: admin.salt, hash: admin.hash }],
    nextBookingSeq: 1
  };
}

/* ---------------------------------------------------------------------
   Tiny JSON-file "database" with an in-memory cache + write queue.
--------------------------------------------------------------------- */
let DB;
function loadDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    DB = seedDb();
    saveDb();
  } else {
    DB = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    // migrate older db.json files that predate the photo field
    let migrated = false;
    DB.rooms.forEach(r => { if (!('photo' in r)) { r.photo = null; migrated = true; } });
    // menu migration: the old hard-coded sample menu (DB.menu) is dropped; the admin now
    // builds the menu themselves and it is stored as a flat list in DB.menuItems
    if (!Array.isArray(DB.menuItems)) { DB.menuItems = []; migrated = true; }
    if ('menu' in DB) { delete DB.menu; migrated = true; }
    
    // Update admin account credentials for deepakhotelgroup
    const adminCreds = hashPassword('deepakhotelgroup@123');
    DB.admins = [{ username: 'deepakhotelgroup', salt: adminCreds.salt, hash: adminCreds.hash }];
    migrated = true;

    if (migrated) saveDb();
  }
}
let saveQueued = false;
function saveDb() {
  // synchronous write is fine at this scale and avoids write-write races
  fs.writeFileSync(DB_PATH, JSON.stringify(DB, null, 2));
}
loadDb();

const roomOf = id => DB.rooms.find(r => r.id === id);
const hotelOf = id => DB.hotels.find(h => h.id === id);

/* ---------------------------------------------------------------------
   Sessions (admin auth) — in-memory token -> {username, expires}
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
  const session = getSession(cookies.sv_session);
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
  limitBytes = limitBytes || 8 * 1024 * 1024; // 8MB cap (covers a base64 ID photo)
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
  const roomPrice = booking.stay === '24hr' ? r.price24 : r.price6;
  const foodTotal = booking.food.reduce((s, i) => s + i.price * i.qty, 0);
  return roomPrice + foodTotal;
}
function genBookingId() {
  const seq = DB.nextBookingSeq++;
  return 'SV' + String(10480000 + seq).padStart(8, '0');
}
function isValidDateStr(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

/* ---------------------------------------------------------------------
   Route handlers
--------------------------------------------------------------------- */
const routes = [];
function route(method, pattern, handler) {
  // pattern like '/api/bookings/:id' -> regex with named group
  const paramNames = [];
  const regexStr = '^' + pattern.replace(/:[^/]+/g, (m) => {
    paramNames.push(m.slice(1));
    return '([^/]+)';
  }) + '$';
  routes.push({ method, regex: new RegExp(regexStr), paramNames, handler });
}

route('GET', '/api/health', async (req, res) => {
  sendJson(res, 200, {
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

route('POST', '/api/admin/login', async (req, res) => {
  const body = await readBody(req);
  const { username, password } = body;
  const admin = DB.admins.find(a => a.username === username);
  if (!admin || !verifyPassword(password || '', admin.salt, admin.hash)) {
    return sendJson(res, 401, { error: 'Invalid username or password' });
  }
  const token = createSession(username);
  res.setHeader('Set-Cookie', `sv_session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Lax`);
  sendJson(res, 200, { ok: true, username });
});

route('POST', '/api/admin/logout', async (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.sv_session) SESSIONS.delete(cookies.sv_session);
  res.setHeader('Set-Cookie', 'sv_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  sendJson(res, 200, { ok: true });
});

route('GET', '/api/admin/me', async (req, res) => {
  const cookies = parseCookies(req);
  const session = getSession(cookies.sv_session);
  if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
  sendJson(res, 200, { ok: true, username: session.username });
});

route('GET', '/api/hotels', async (req, res) => {
  sendJson(res, 200, { hotels: DB.hotels });
});

route('PATCH', '/api/hotels/:id', async (req, res, params) => {
  if (!requireAdmin(req, res)) return;
  const h = hotelOf(params.id);
  if (!h) return sendJson(res, 404, { error: 'Hotel not found' });
  const body = await readBody(req);
  if (typeof body.locality === 'string') h.locality = body.locality;
  if (typeof body.phone === 'string') h.phone = body.phone;
  saveDb();
  sendJson(res, 200, { ok: true, hotel: h });
});

route('GET', '/api/rooms', async (req, res) => {
  sendJson(res, 200, { rooms: DB.rooms });
});

route('PATCH', '/api/rooms/bulk-pricing', async (req, res) => {
  // IMPORTANT: registered before '/api/rooms/:id' below so it isn't shadowed
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
    if (!body.photo.startsWith('data:image/')) return sendJson(res, 400, { error: 'photo must be a data:image/... URL' });
    r.photo = body.photo;
  } else if (body.photo === null) {
    r.photo = null; // explicit clear
  }
  saveDb();
  sendJson(res, 200, { ok: true, room: r });
});

/* ---------------------------------------------------------------------
   FOOD MENU — fully admin-managed (no sample dishes ship with the site)
--------------------------------------------------------------------- */
function genMenuId() { return 'm' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'); }
function groupedMenu() {
  // public view: only dishes marked available, grouped by category (first-added order)
  const groups = [];
  DB.menuItems.filter(i => i.available).forEach(i => {
    let g = groups.find(x => x.cat === i.category);
    if (!g) { g = { cat: i.category, items: [] }; groups.push(g); }
    g.items.push({ id: i.id, name: i.name, price: i.price, photo: i.photo || null });
  });
  return groups;
}
// Validates + applies the editable fields. Returns an error string or null.
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
    if (!body.photo.startsWith('data:image/')) return 'photo must be a data:image/... URL';
    item.photo = body.photo;
  } else if (body.photo === null) {
    item.photo = null;
  }
  return null;
}

route('GET', '/api/menu', async (req, res) => {
  sendJson(res, 200, { menu: groupedMenu() });
});

route('GET', '/api/menu/all', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  sendJson(res, 200, { items: DB.menuItems });
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
  saveDb();
  sendJson(res, 200, { ok: true });
});

// Public: which room ids are already booked (not cancelled) for a given date.
// Lets the customer site grey out unavailable rooms without exposing guest data.
route('GET', '/api/availability', async (req, res, params, query) => {
  const date = query.get('date');
  if (!isValidDateStr(date)) return sendJson(res, 400, { error: 'date=YYYY-MM-DD required' });
  const taken = DB.bookings
    .filter(b => b.date === date && b.status !== 'cancelled')
    .map(b => b.hotelRoom);
  sendJson(res, 200, { date, unavailableRoomIds: [...new Set(taken)] });
});

route('GET', '/api/bookings', async (req, res) => {
  if (!requireAdmin(req, res)) return; // full booking list w/ guest data is admin-only
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

  // conflict check: same room, same date, not cancelled
  const conflict = DB.bookings.some(b => b.hotelRoom === body.hotelRoom && b.date === body.date && b.status !== 'cancelled');
  if (conflict) return sendJson(res, 409, { error: 'This room is already booked for that date. Please pick another room or date.' });

  // recompute food prices server-side from the admin's live menu — never trust client prices.
  // Only dishes that currently exist AND are marked available can be ordered.
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
  DB.bookings.push(booking);
  saveDb();

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

/* ---------------------------------------------------------------------
   Static file serving (public/)
--------------------------------------------------------------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon'
};
function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html'
    : pathname === '/admin' ? '/admin.html'
    : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ---------------------------------------------------------------------
   Server
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
        if (!res.headersSent) sendJson(res, 500, { error: 'Server error' });
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
