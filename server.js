import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import sessionFileStoreFactory from 'session-file-store';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const isProd = process.env.NODE_ENV === 'production';
if (isProd) app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const FileStore = sessionFileStoreFactory(session);
const sessionDir = path.join(__dirname, 'data', 'sessions');
const sessionStore = new FileStore({
  path: sessionDir,
  ttl: 8 * 60 * 60,
  retries: 2,
  reapInterval: 60 * 60,
  logFn: () => {},
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-only-not-secure',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

function requireAuth(req, res, next) {
  if (!req.session?.sf) return res.redirect('/');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.sf) return res.redirect('/');
  if (!req.session.sf.isAdmin) {
    return res.status(403).render('error', {
      title: 'Restricted',
      message: 'This area is reserved for users with the System Administrator profile.',
    });
  }
  next();
}

app.use((req, res, next) => {
  res.locals.user = req.session?.sf || null;
  res.locals.path = req.path;
  next();
});

app.get('/', (req, res) => {
  if (req.session?.sf) return res.redirect('/app');
  res.render('login');
});

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

app.get('/app', requireAuth, (req, res) => res.render('dashboard'));
app.get('/app/invite', requireAuth, (req, res) => res.render('invite'));
app.get('/app/invitations', requireAuth, (req, res) => res.render('invitations'));
app.get('/app/scan', requireAuth, (req, res) => res.render('scan'));
app.get('/app/walkin', requireAuth, (req, res) => res.render('walkin'));
app.get('/app/events', requireAdmin, (req, res) => res.render('events'));
app.get('/app/ticket/:ticket', requireAuth, (req, res) => {
  res.render('ticket', { ticket: req.params.ticket });
});

app.use((err, req, res, _next) => {
  console.error(err);
  if (req.path.startsWith('/api')) {
    res.status(500).json({ error: err.message || 'Internal error' });
  } else {
    res.status(500).render('error', {
      title: 'Something went wrong',
      message: err.message || 'An unexpected error occurred.',
    });
  }
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Allegiance Event QR listening on ${HOST}:${PORT}`);
});
