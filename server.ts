import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  ActivityEvent,
  AutomatedReport,
  Book,
  BootstrapState,
  LoanRecord,
  UserRole,
  UserSession,
} from './src/types.ts';
import {
  buildReportRecord,
  computeStatistics,
  constantTimeStringEquals,
  hashPassword,
  loadDatabase,
  recordActivity,
  refreshLoanStatuses,
  saveDatabase,
  verifyPassword,
} from './server/store.ts';
import type { StoredUser } from './server/store.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

interface TokenPayload {
  sub: string;
  name: string;
  email: string;
  role: UserRole;
  memberCode: string;
  joinedAt: string;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  user?: UserSession;
}

interface ClientSocketMeta {
  ws: WebSocket;
  user: UserSession | null;
}

function signToken(user: UserSession): string {
  const payload: TokenPayload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    memberCode: user.memberCode,
    joinedAt: user.joinedAt,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token: string): UserSession | null {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (!constantTimeStringEquals(providedSig, expectedSig)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return {
      id: parsed.sub,
      name: parsed.name,
      email: parsed.email,
      role: parsed.role,
      memberCode: parsed.memberCode,
      joinedAt: parsed.joinedAt,
    };
  } catch {
    return null;
  }
}

function extractBearerUser(req: Request): UserSession | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return verifyToken(token);
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const user = extractBearerUser(req);
  if (!user) {
    res.status(401).json({ error: 'Silakan masuk terlebih dahulu untuk mengakses fitur ini.' });
    return;
  }
  req.user = user;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const user = extractBearerUser(req);
  if (!user) {
    res.status(401).json({ error: 'Autentikasi diperlukan.' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Akses ditolak. Diperlukan hak akses Admin Pustakawan.' });
    return;
  }
  req.user = user;
  next();
}

function sanitizeImageUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/src/assets/images/') && !trimmed.includes('..')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toPublicUser(user: StoredUser): UserSession {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    memberCode: user.memberCode,
    joinedAt: user.joinedAt,
  };
}

function getScopedLoans(allLoans: LoanRecord[], user: UserSession | null): LoanRecord[] {
  if (!user) return [];
  if (user.role === 'admin') return allLoans;
  return allLoans.filter((loan) => loan.userId === user.id);
}

function sanitizeActivitiesForPublic(activities: ActivityEvent[]): ActivityEvent[] {
  return activities.map((act) => ({
    ...act,
    actorName: act.actorRole === 'admin' ? act.actorName : `${act.actorName.split(' ')[0]} (${act.actorRole === 'member' ? 'Anggota' : 'Staf'})`,
  }));
}

async function startServer() {
  const db = loadDatabase();
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set<ClientSocketMeta>();

  function buildBootstrapForUser(user: UserSession | null): BootstrapState {
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const hasClaimedAdmin = db.users.some((u) => u.role === 'admin');
    const stats = computeStatistics(db);
    return {
      books: db.books,
      loans: getScopedLoans(db.loans, user),
      activities: user?.role === 'admin' ? db.activities : sanitizeActivitiesForPublic(db.activities),
      reports: user?.role === 'admin' ? db.reports : [],
      stats,
      adminConfigured: Boolean(envPasscode) || hasClaimedAdmin,
      adminPasscodeManagedByEnv: Boolean(envPasscode),
      onlineConnections: clients.size,
    };
  }

  function broadcastEvent(eventName: string, latestActivity?: ActivityEvent) {
    for (const client of clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      const payload = {
        type: 'sync',
        eventName,
        latestActivity: latestActivity
          ? client.user?.role === 'admin'
            ? latestActivity
            : sanitizeActivitiesForPublic([latestActivity])[0]
          : null,
        state: buildBootstrapForUser(client.user),
      };
      client.ws.send(JSON.stringify(payload));
    }
  }

  function broadcastPresence() {
    for (const client of clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      client.ws.send(
        JSON.stringify({
          type: 'presence',
          onlineConnections: clients.size,
        })
      );
    }
  }

  wss.on('connection', (ws) => {
    const meta: ClientSocketMeta = { ws, user: null };
    clients.add(meta);
    broadcastPresence();

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; token?: string | null };
        if (msg.type === 'auth') {
          meta.user = msg.token ? verifyToken(msg.token) : null;
          ws.send(
            JSON.stringify({
              type: 'sync',
              eventName: 'auth:synced',
              latestActivity: null,
              state: buildBootstrapForUser(meta.user),
            })
          );
        }
      } catch {
        // Ignore malformed client frames
      }
    });

    ws.on('close', () => {
      clients.delete(meta);
      broadcastPresence();
    });
  });

  // Periodic automated reporting & overdue checker (runs every 60 seconds)
  const reportSchedulerTimer = setInterval(() => {
    let dirty = refreshLoanStatuses(db);
    const schedule = db.reportSchedule;
    if (schedule.enabled) {
      const now = Date.now();
      const nextMs = new Date(schedule.nextScheduledRunAt).getTime();
      if (now >= nextMs) {
        const autoReport = buildReportRecord(db, schedule.frequency, 'Penjadwalan Otomatis Server');
        db.reports.unshift(autoReport);
        const intervalDays = schedule.frequency === 'harian' ? 1 : schedule.frequency === 'mingguan' ? 7 : 30;
        schedule.lastAutoRunAt = new Date(now).toISOString();
        schedule.nextScheduledRunAt = new Date(now + intervalDays * 24 * 60 * 60 * 1000).toISOString();
        const act = recordActivity(
          db,
          'report:generated',
          'Sistem Pelaporan Otomatis',
          'admin',
          `Laporan terjadwal ${schedule.frequency} (${autoReport.reportCode}) diterbitkan`,
          autoReport.reportCode
        );
        saveDatabase(db);
        broadcastEvent('report:generated', act);
        dirty = false;
      }
    }
    if (dirty) {
      saveDatabase(db);
      broadcastEvent('loans:overdue_sync');
    }
  }, 60_000);
  reportSchedulerTimer.unref();

  // --- API Routes ---

  app.get('/api/bootstrap', (req, res) => {
    const user = extractBearerUser(req);
    res.json(buildBootstrapForUser(user));
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  app.post('/api/auth/setup-admin', (req, res) => {
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const existingAdmin = db.users.find((u) => u.role === 'admin');
    if (envPasscode || existingAdmin) {
      res.status(409).json({
        error: 'Akun Admin sudah dikonfigurasi. Silakan masuk menggunakan kredensial Admin.',
      });
      return;
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ error: 'Nama Admin harus antara 2 hingga 80 karakter.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Format email tidak valid.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Kata sandi Admin minimal 8 karakter.' });
      return;
    }
    if (db.users.some((u) => u.email === email)) {
      res.status(409).json({ error: 'Email sudah terdaftar.' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const adminUser: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      name,
      email,
      role: 'admin',
      memberCode: 'ADM-0001',
      passwordHash: hash,
      passwordSalt: salt,
      joinedAt: new Date().toISOString(),
    };

    db.users.push(adminUser);
    saveDatabase(db);
    const sessionUser = toPublicUser(adminUser);
    const token = signToken(sessionUser);
    broadcastEvent('admin:configured');
    res.status(201).json({ token, user: sessionUser });
  });

  app.post('/api/auth/register', (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ error: 'Nama lengkap harus antara 2 hingga 80 karakter.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Format alamat email tidak valid.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
      return;
    }
    if (db.users.some((u) => u.email === email)) {
      res.status(409).json({ error: 'Email ini sudah terdaftar sebagai anggota.' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const memberNumber = 1050 + db.users.filter((u) => u.role === 'member').length;
    const newUser: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      name,
      email,
      role: 'member',
      memberCode: `MBR-${memberNumber}`,
      passwordHash: hash,
      passwordSalt: salt,
      joinedAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    const act = recordActivity(
      db,
      'member:registered',
      newUser.name,
      'member',
      `Anggota baru terdaftar (${newUser.memberCode})`,
      newUser.memberCode
    );
    saveDatabase(db);

    const sessionUser = toPublicUser(newUser);
    const token = signToken(sessionUser);
    broadcastEvent('member:registered', act);
    res.status(201).json({ token, user: sessionUser });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const loginAs = req.body?.role === 'admin' ? 'admin' : 'member';

    if (!password) {
      res.status(400).json({ error: 'Kata sandi atau kode akses wajib diisi.' });
      return;
    }

    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    if (loginAs === 'admin' && envPasscode) {
      if (!constantTimeStringEquals(password, envPasscode)) {
        res.status(401).json({ error: 'Kode akses Admin tidak sesuai.' });
        return;
      }
      const adminUser: UserSession = {
        id: 'env-admin-1',
        name: 'Administrator Pustaka',
        email: email || 'admin@aksarapustaka.id',
        role: 'admin',
        memberCode: 'ADM-0001',
        joinedAt: new Date().toISOString(),
      };
      const token = signToken(adminUser);
      res.json({ token, user: adminUser });
      return;
    }

    if (!email) {
      res.status(400).json({ error: 'Alamat email wajib diisi.' });
      return;
    }

    const found = db.users.find((u) => u.email === email);
    if (!found || !verifyPassword(password, found.passwordHash, found.passwordSalt)) {
      res.status(401).json({ error: 'Email atau kata sandi tidak valid.' });
      return;
    }

    if (loginAs === 'admin' && found.role !== 'admin') {
      res.status(403).json({ error: 'Akun ini terdaftar sebagai Anggota, bukan Admin.' });
      return;
    }

    const sessionUser = toPublicUser(found);
    const token = signToken(sessionUser);
    res.json({ token, user: sessionUser });
  });

  // --- Book Collection Management (Admin Only for Mutations) ---

  app.post('/api/books', requireAdmin, (req: AuthenticatedRequest, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const author = typeof req.body?.author === 'string' ? req.body.author.trim() : '';
    const isbn = typeof req.body?.isbn === 'string' ? req.body.isbn.trim() : '';
    const publisher = typeof req.body?.publisher === 'string' ? req.body.publisher.trim() : 'Pustaka Digital';
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : 'Umum';
    const shelfCode = typeof req.body?.shelfCode === 'string' ? req.body.shelfCode.trim().toUpperCase() : 'U-01';
    const synopsis = typeof req.body?.synopsis === 'string' ? req.body.synopsis.trim() : '';
    const year = Number(req.body?.year) || new Date().getFullYear();
    const totalCopies = Math.max(1, Math.min(200, Math.floor(Number(req.body?.totalCopies) || 1)));
    const coverUrl = sanitizeImageUrl(req.body?.coverUrl);

    if (title.length < 2 || title.length > 140) {
      res.status(400).json({ error: 'Judul buku harus diisi (2–140 karakter).' });
      return;
    }
    if (author.length < 2 || author.length > 100) {
      res.status(400).json({ error: 'Nama penulis harus diisi.' });
      return;
    }
    if (isbn.length < 5 || isbn.length > 32) {
      res.status(400).json({ error: 'ISBN tidak valid.' });
      return;
    }

    const now = new Date().toISOString();
    const book: Book = {
      id: `bk-${crypto.randomUUID().slice(0, 6)}`,
      isbn,
      title,
      author,
      publisher: publisher || 'Pustaka Digital',
      year: Math.max(1800, Math.min(2100, year)),
      category: category || 'Umum',
      shelfCode: shelfCode || 'U-01',
      totalCopies,
      availableCopies: totalCopies,
      borrowCount: 0,
      coverUrl,
      synopsis: synopsis || 'Koleksi referensi perpustakaan digital Aksara Pustaka.',
      createdAt: now,
      updatedAt: now,
    };

    db.books.unshift(book);
    const act = recordActivity(
      db,
      'book:created',
      req.user!.name,
      'admin',
      `Menambahkan koleksi baru "${book.title}" (${book.totalCopies} eksemplar)`,
      book.isbn
    );
    saveDatabase(db);
    broadcastEvent('book:created', act);
    res.status(201).json({ book });
  });

  app.patch('/api/books/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    const book = db.books.find((b) => b.id === req.params.id);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan dalam koleksi.' });
      return;
    }

    const activeBorrowed = db.loans.filter((l) => l.bookId === book.id && l.status !== 'returned').length;

    if (typeof req.body?.title === 'string' && req.body.title.trim().length >= 2) {
      book.title = req.body.title.trim().slice(0, 140);
    }
    if (typeof req.body?.author === 'string' && req.body.author.trim().length >= 2) {
      book.author = req.body.author.trim().slice(0, 100);
    }
    if (typeof req.body?.isbn === 'string' && req.body.isbn.trim().length >= 5) {
      book.isbn = req.body.isbn.trim().slice(0, 32);
    }
    if (typeof req.body?.publisher === 'string' && req.body.publisher.trim()) {
      book.publisher = req.body.publisher.trim().slice(0, 100);
    }
    if (typeof req.body?.category === 'string' && req.body.category.trim()) {
      book.category = req.body.category.trim().slice(0, 50);
    }
    if (typeof req.body?.shelfCode === 'string' && req.body.shelfCode.trim()) {
      book.shelfCode = req.body.shelfCode.trim().toUpperCase().slice(0, 16);
    }
    if (typeof req.body?.synopsis === 'string') {
      book.synopsis = req.body.synopsis.trim().slice(0, 600);
    }
    if (req.body?.year !== undefined) {
      const y = Number(req.body.year);
      if (!Number.isNaN(y) && y >= 1800 && y <= 2100) {
        book.year = Math.floor(y);
      }
    }
    if (req.body?.totalCopies !== undefined) {
      const nextTotal = Math.floor(Number(req.body.totalCopies));
      if (Number.isNaN(nextTotal) || nextTotal < activeBorrowed) {
        res.status(400).json({
          error: `Total eksemplar tidak boleh kurang dari jumlah yang sedang dipinjam (${activeBorrowed}).`,
        });
        return;
      }
      book.totalCopies = Math.min(200, nextTotal);
      book.availableCopies = Math.max(0, book.totalCopies - activeBorrowed);
    }
    if (req.body?.coverUrl !== undefined) {
      book.coverUrl = sanitizeImageUrl(req.body.coverUrl);
    }

    book.updatedAt = new Date().toISOString();
    const act = recordActivity(
      db,
      'book:updated',
      req.user!.name,
      'admin',
      `Memperbarui data koleksi "${book.title}"`,
      book.isbn
    );
    saveDatabase(db);
    broadcastEvent('book:updated', act);
    res.json({ book });
  });

  app.delete('/api/books/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    const idx = db.books.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }
    const book = db.books[idx];
    const hasActiveLoans = db.loans.some((l) => l.bookId === book.id && l.status !== 'returned');
    if (hasActiveLoans) {
      res.status(400).json({
        error: 'Buku tidak dapat dihapus karena masih ada salinan yang sedang dipinjam anggota.',
      });
      return;
    }

    db.books.splice(idx, 1);
    const act = recordActivity(
      db,
      'book:deleted',
      req.user!.name,
      'admin',
      `Menghapus "${book.title}" dari katalog koleksi`,
      book.isbn
    );
    saveDatabase(db);
    broadcastEvent('book:deleted', act);
    res.json({ success: true });
  });

  // --- Circulation / Loan Transactions ---

  app.post('/api/loans', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const bookId = typeof req.body?.bookId === 'string' ? req.body.bookId : '';
    const durationDays = [3, 7, 14].includes(Number(req.body?.durationDays))
      ? Number(req.body.durationDays)
      : 7;

    const book = db.books.find((b) => b.id === bookId);
    if (!book) {
      res.status(404).json({ error: 'Buku yang dipilih tidak ditemukan.' });
      return;
    }
    if (book.availableCopies <= 0) {
      res.status(400).json({ error: 'Stok buku ini sedang habis dipinjam.' });
      return;
    }

    let targetUser: { id: string; name: string; email: string; memberCode: string } = {
      id: user.id,
      name: user.name,
      email: user.email,
      memberCode: user.memberCode,
    };

    if (user.role === 'admin' && typeof req.body?.memberEmail === 'string' && req.body.memberEmail.trim()) {
      const lookupEmail = req.body.memberEmail.trim().toLowerCase();
      const matchedMember = db.users.find((u) => u.email === lookupEmail);
      if (!matchedMember) {
        res.status(404).json({ error: 'Anggota dengan email tersebut belum terdaftar.' });
        return;
      }
      targetUser = {
        id: matchedMember.id,
        name: matchedMember.name,
        email: matchedMember.email,
        memberCode: matchedMember.memberCode,
      };
    }

    const alreadyBorrowingSameBook = db.loans.some(
      (l) => l.bookId === book.id && l.userId === targetUser.id && l.status !== 'returned'
    );
    if (alreadyBorrowingSameBook) {
      res.status(400).json({ error: 'Anda masih memiliki peminjaman aktif untuk judul buku ini.' });
      return;
    }

    const activeCount = db.loans.filter((l) => l.userId === targetUser.id && l.status !== 'returned').length;
    if (activeCount >= 5) {
      res.status(400).json({ error: 'Batas maksimal 5 peminjaman aktif per anggota telah tercapai.' });
      return;
    }

    const now = new Date();
    const due = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const codeNumber = String(db.loans.length + 1).padStart(3, '0');
    const loan: LoanRecord = {
      id: `ln-${crypto.randomUUID().slice(0, 8)}`,
      loanCode: `TRX-${now.toISOString().slice(2, 7).replace('-', '')}-${codeNumber}`,
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      bookIsbn: book.isbn,
      userId: targetUser.id,
      memberName: targetUser.name,
      memberEmail: targetUser.email,
      memberCode: targetUser.memberCode,
      borrowedAt: now.toISOString(),
      dueAt: due.toISOString(),
      returnedAt: null,
      renewCount: 0,
      status: 'active',
      fineAmount: 0,
    };

    book.availableCopies = Math.max(0, book.availableCopies - 1);
    book.borrowCount += 1;
    book.updatedAt = now.toISOString();
    db.loans.unshift(loan);

    const act = recordActivity(
      db,
      'loan:created',
      targetUser.name,
      user.role,
      `Meminjam "${book.title}" selama ${durationDays} hari`,
      loan.loanCode
    );
    saveDatabase(db);
    broadcastEvent('loan:created', act);
    res.status(201).json({ loan });
  });

  app.post('/api/loans/:id/return', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const loan = db.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      res.status(404).json({ error: 'Transaksi peminjaman tidak ditemukan.' });
      return;
    }
    if (user.role !== 'admin' && loan.userId !== user.id) {
      res.status(403).json({ error: 'Anda tidak berwenang mengembalikan transaksi anggota lain.' });
      return;
    }
    if (loan.status === 'returned') {
      res.status(400).json({ error: 'Buku pada transaksi ini sudah dikembalikan sebelumnya.' });
      return;
    }

    refreshLoanStatuses(db);
    loan.returnedAt = new Date().toISOString();
    loan.status = 'returned';

    const book = db.books.find((b) => b.id === loan.bookId);
    if (book) {
      book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
      book.updatedAt = loan.returnedAt;
    }

    const act = recordActivity(
      db,
      'loan:returned',
      user.role === 'admin' ? `${user.name} (Admin)` : loan.memberName,
      user.role,
      `Mengembalikan "${loan.bookTitle}"`,
      loan.loanCode
    );
    saveDatabase(db);
    broadcastEvent('loan:returned', act);
    res.json({ loan });
  });

  app.post('/api/loans/:id/extend', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const loan = db.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
      return;
    }
    if (user.role !== 'admin' && loan.userId !== user.id) {
      res.status(403).json({ error: 'Anda tidak berwenang memperpanjang transaksi anggota lain.' });
      return;
    }
    refreshLoanStatuses(db);
    if (loan.status === 'returned') {
      res.status(400).json({ error: 'Transaksi yang sudah selesai tidak dapat diperpanjang.' });
      return;
    }
    if (loan.status === 'overdue' && user.role !== 'admin') {
      res.status(400).json({ error: 'Peminjaman yang terlambat hanya dapat diperpanjang oleh Admin.' });
      return;
    }
    if (loan.renewCount >= 2) {
      res.status(400).json({ error: 'Batas maksimal perpanjangan (2 kali) telah tercapai.' });
      return;
    }

    const nextDue = new Date(new Date(loan.dueAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    loan.dueAt = nextDue.toISOString();
    loan.renewCount += 1;
    loan.status = 'active';
    loan.fineAmount = 0;

    const act = recordActivity(
      db,
      'loan:extended',
      user.name,
      user.role,
      `Memperpanjang durasi pinjam "${loan.bookTitle}" (+7 hari)`,
      loan.loanCode
    );
    saveDatabase(db);
    broadcastEvent('loan:extended', act);
    res.json({ loan });
  });

  // --- Admin Members & Automated Reporting Routes ---

  app.get('/api/members', requireAdmin, (_req, res) => {
    refreshLoanStatuses(db);
    const memberMap = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        memberCode: string;
        joinedAt: string;
        activeLoans: number;
        overdueLoans: number;
        totalLoans: number;
        totalFinesIdr: number;
        registeredAccount: boolean;
      }
    >();

    for (const u of db.users) {
      if (u.role !== 'member') continue;
      memberMap.set(u.id, {
        id: u.id,
        name: u.name,
        email: u.email,
        memberCode: u.memberCode,
        joinedAt: u.joinedAt,
        activeLoans: 0,
        overdueLoans: 0,
        totalLoans: 0,
        totalFinesIdr: 0,
        registeredAccount: true,
      });
    }

    for (const loan of db.loans) {
      const existing = memberMap.get(loan.userId) || {
        id: loan.userId,
        name: loan.memberName,
        email: loan.memberEmail,
        memberCode: loan.memberCode,
        joinedAt: loan.borrowedAt,
        activeLoans: 0,
        overdueLoans: 0,
        totalLoans: 0,
        totalFinesIdr: 0,
        registeredAccount: false,
      };
      existing.totalLoans += 1;
      if (loan.status === 'active') existing.activeLoans += 1;
      if (loan.status === 'overdue') existing.overdueLoans += 1;
      existing.totalFinesIdr += loan.fineAmount;
      memberMap.set(loan.userId, existing);
    }

    res.json({ members: Array.from(memberMap.values()) });
  });

  app.get('/api/reports/schedule', requireAdmin, (_req, res) => {
    res.json({ schedule: db.reportSchedule });
  });

  app.put('/api/reports/schedule', requireAdmin, (req: AuthenticatedRequest, res) => {
    const enabled = Boolean(req.body?.enabled);
    const frequency = ['harian', 'mingguan', 'bulanan'].includes(req.body?.frequency)
      ? (req.body.frequency as 'harian' | 'mingguan' | 'bulanan')
      : db.reportSchedule.frequency;

    const intervalDays = frequency === 'harian' ? 1 : frequency === 'mingguan' ? 7 : 30;
    db.reportSchedule = {
      enabled,
      frequency,
      lastAutoRunAt: db.reportSchedule.lastAutoRunAt,
      nextScheduledRunAt: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString(),
    };
    saveDatabase(db);
    res.json({ schedule: db.reportSchedule });
  });

  app.post('/api/reports/generate', requireAdmin, (req: AuthenticatedRequest, res) => {
    const scheduleType = ['harian', 'mingguan', 'bulanan', 'manual'].includes(req.body?.scheduleType)
      ? (req.body.scheduleType as AutomatedReport['scheduleType'])
      : 'manual';

    const report = buildReportRecord(db, scheduleType, req.user!.name);
    db.reports.unshift(report);
    const act = recordActivity(
      db,
      'report:generated',
      req.user!.name,
      'admin',
      `Menerbitkan laporan otomatis (${report.reportCode})`,
      report.reportCode
    );
    saveDatabase(db);
    broadcastEvent('report:generated', act);
    res.status(201).json({ report });
  });

  app.get('/api/reports/:id/csv', requireAdmin, (req, res) => {
    const report = db.reports.find((r) => r.id === req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Laporan tidak ditemukan.' });
      return;
    }

    const lines: string[] = [
      ['Kode Laporan', 'Judul', 'Periode', 'Waktu Terbit', 'Dibuat Oleh'].map(escapeCsvCell).join(','),
      [report.reportCode, report.title, report.periodLabel, report.generatedAt, report.generatedBy]
        .map(escapeCsvCell)
        .join(','),
      '',
      ['Metrik', 'Nilai'].map(escapeCsvCell).join(','),
      ['Total Judul Katalog', report.metrics.totalCatalogTitles].map(escapeCsvCell).join(','),
      ['Total Eksemplar', report.metrics.totalCopies].map(escapeCsvCell).join(','),
      ['Eksemplar Tersedia', report.metrics.availableCopies].map(escapeCsvCell).join(','),
      ['Peminjaman Aktif', report.metrics.activeLoans].map(escapeCsvCell).join(','),
      ['Peminjaman Terlambat', report.metrics.overdueLoans].map(escapeCsvCell).join(','),
      ['Sudah Dikembalikan', report.metrics.returnedLoans].map(escapeCsvCell).join(','),
      ['Total Transaksi', report.metrics.totalTransactions].map(escapeCsvCell).join(','),
      ['Akumulasi Denda (IDR)', report.metrics.totalFinesIdr].map(escapeCsvCell).join(','),
      ['Tingkat Pemanfaatan (%)', report.metrics.utilizationRatePercent].map(escapeCsvCell).join(','),
      '',
      ['Judul Buku Terpopuler', 'Penulis', 'Kategori', 'Total Dipinjam'].map(escapeCsvCell).join(','),
      ...report.topBooks.map((b) => [b.title, b.author, b.category, b.borrowCount].map(escapeCsvCell).join(',')),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${report.reportCode}.csv"`);
    res.send('\uFEFF' + lines.join('\n'));
  });

  // --- Vite / Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.resolve(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Aksara Pustaka server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
