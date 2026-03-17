'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const ROLE_PERMISSIONS = {
  Admin: ['read', 'create', 'update', 'delete', 'settings'],
  Manager: ['read', 'create', 'update', 'settings'],
  User: ['read']
};

const usersDb = [
  {
    id: 1,
    username: 'admin',
    password: 'Admin@123',
    role: 'Admin',
    email: 'admin@global-standard.com',
    name: 'Alex Morgan'
  },
  {
    id: 2,
    username: 'manager',
    password: 'Manager@123',
    role: 'Manager',
    email: 'manager@global-standard.com',
    name: 'Priya Lin'
  },
  {
    id: 3,
    username: 'user',
    password: 'User@123',
    role: 'User',
    email: 'user@global-standard.com',
    name: 'Jordan Lee'
  }
];

let dataRecords = [
  { id: 1, label: 'North America', revenue: 145000, performance: 82, activeUsers: 3200, category: 'Region' },
  { id: 2, label: 'Europe', revenue: 112000, performance: 76, activeUsers: 2900, category: 'Region' },
  { id: 3, label: 'APAC', revenue: 184000, performance: 89, activeUsers: 4100, category: 'Region' }
];

const sessions = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '300kb' }));
app.use(express.urlencoded({ extended: false, limit: '300kb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
});
app.use(express.static(path.join(__dirname), {
  maxAge: '1d',
  etag: true
}));

function parseCookies(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((cookiePart) => cookiePart.trim())
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex > -1) {
        const key = decodeURIComponent(part.slice(0, separatorIndex));
        const value = decodeURIComponent(part.slice(separatorIndex + 1));
        cookies[key] = value;
      }
      return cookies;
    }, {});
}

function setCookie(res, name, value, options = {}) {
  const cookieParts = [`${name}=${encodeURIComponent(value)}`];

  if (options.httpOnly) cookieParts.push('HttpOnly');
  if (options.secure) cookieParts.push('Secure');
  if (options.sameSite) cookieParts.push(`SameSite=${options.sameSite}`);
  if (options.maxAge) cookieParts.push(`Max-Age=${options.maxAge}`);
  cookieParts.push('Path=/');

  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`);
}

function sanitizeText(value, maxLen = 120) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

function getAuthUser(req) {
  const token = parseCookies(req).session_id;
  if (!token || !sessions.has(token)) {
    return null;
  }
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function requireAuth(req, res, next) {
  const session = getAuthUser(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.session = session;
  return next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    const permissions = ROLE_PERMISSIONS[req.session.role] || [];
    if (!permissions.includes(permission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  };
}

app.post('/api/login', (req, res) => {
  const username = sanitizeText(req.body.username, 40).toLowerCase();
  const password = sanitizeText(req.body.password, 80);

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = usersDb.find((entry) => entry.username === username && entry.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 1000 * 60 * 60 * 8;
  sessions.set(token, {
    userId: user.id,
    role: user.role,
    username: user.username,
    name: user.name,
    expiresAt
  });

  setCookie(res, 'session_id', token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8
  });

  return res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      email: user.email
    }
  });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const token = parseCookies(req).session_id;
  sessions.delete(token);
  clearCookie(res, 'session_id');
  res.json({ message: 'Logged out' });
});

app.get('/api/me', requireAuth, (req, res) => {
  const profile = usersDb.find((u) => u.id === req.session.userId);
  res.json({
    user: {
      id: profile.id,
      username: profile.username,
      role: profile.role,
      name: profile.name,
      email: profile.email
    },
    permissions: ROLE_PERMISSIONS[profile.role] || []
  });
});

app.get('/api/users', requireAuth, requirePermission('read'), (req, res) => {
  const safeUsers = usersDb.map((u) => ({ id: u.id, username: u.username, role: u.role, email: u.email, name: u.name }));
  res.json({ users: safeUsers });
});

app.post('/api/users', requireAuth, requirePermission('create'), (req, res) => {
  const username = sanitizeText(req.body.username, 40).toLowerCase();
  const name = sanitizeText(req.body.name, 90);
  const email = sanitizeText(req.body.email, 120);
  const role = sanitizeText(req.body.role, 15);

  if (!username || !name || !email || !ROLE_PERMISSIONS[role]) {
    return res.status(400).json({ error: 'Invalid input values.' });
  }

  if (usersDb.some((u) => u.username === username)) {
    return res.status(409).json({ error: 'Username already exists.' });
  }

  const id = usersDb.length ? Math.max(...usersDb.map((u) => u.id)) + 1 : 1;
  usersDb.push({
    id,
    username,
    role,
    name,
    email,
    password: 'Temp@123'
  });

  return res.status(201).json({ message: 'User created', id });
});

app.put('/api/users/:id', requireAuth, requirePermission('update'), (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const user = usersDb.find((entry) => entry.id === id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const name = sanitizeText(req.body.name, 90);
  const email = sanitizeText(req.body.email, 120);
  const role = sanitizeText(req.body.role, 15);

  if (name) user.name = name;
  if (email) user.email = email;
  if (role && ROLE_PERMISSIONS[role]) user.role = role;

  return res.json({ message: 'User updated' });
});

app.delete('/api/users/:id', requireAuth, requirePermission('delete'), (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const index = usersDb.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  usersDb.splice(index, 1);
  return res.json({ message: 'User deleted' });
});

app.get('/api/data', requireAuth, requirePermission('read'), (req, res) => {
  res.json({ data: dataRecords });
});

app.post('/api/data', requireAuth, requirePermission('create'), (req, res) => {
  const label = sanitizeText(req.body.label, 60);
  const category = sanitizeText(req.body.category, 40);
  const revenue = Number(req.body.revenue);
  const performance = Number(req.body.performance);
  const activeUsers = Number(req.body.activeUsers);

  if (!label || !category || [revenue, performance, activeUsers].some((value) => !Number.isFinite(value) || value < 0)) {
    return res.status(400).json({ error: 'Invalid record payload.' });
  }

  const id = dataRecords.length ? Math.max(...dataRecords.map((d) => d.id)) + 1 : 1;
  dataRecords.push({ id, label, category, revenue, performance, activeUsers });
  return res.status(201).json({ message: 'Record created', id });
});

app.put('/api/data/:id', requireAuth, requirePermission('update'), (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const record = dataRecords.find((item) => item.id === id);

  if (!record) {
    return res.status(404).json({ error: 'Record not found.' });
  }

  if (req.body.label) record.label = sanitizeText(req.body.label, 60);
  if (req.body.category) record.category = sanitizeText(req.body.category, 40);
  if (req.body.revenue !== undefined) record.revenue = Number(req.body.revenue) || 0;
  if (req.body.performance !== undefined) record.performance = Number(req.body.performance) || 0;
  if (req.body.activeUsers !== undefined) record.activeUsers = Number(req.body.activeUsers) || 0;

  return res.json({ message: 'Record updated' });
});

app.delete('/api/data/:id', requireAuth, requirePermission('delete'), (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  dataRecords = dataRecords.filter((item) => item.id !== id);
  res.json({ message: 'Record deleted' });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Global Standard dashboard running on port ${PORT}`);
});
