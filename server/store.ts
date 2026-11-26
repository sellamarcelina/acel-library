import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ActivityEvent,
  ActivityType,
  AutomatedReport,
  Book,
  LibraryStatistics,
  LoanRecord,
  UserRole,
} from '../src/types.ts';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  memberCode: string;
  passwordHash: string;
  passwordSalt: string;
  joinedAt: string;
}

export interface ReportScheduleConfig {
  enabled: boolean;
  frequency: 'harian' | 'mingguan' | 'bulanan';
  lastAutoRunAt: string | null;
  nextScheduledRunAt: string;
}

export interface LibraryDatabase {
  users: StoredUser[];
  books: Book[];
  loans: LoanRecord[];
  activities: ActivityEvent[];
  reports: AutomatedReport[];
  reportSchedule: ReportScheduleConfig;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.resolve(DATA_DIR, 'library-db.json');

export const DAILY_FINE_IDR = 2000;

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const derived = crypto.scryptSync(password, storedSalt, 64);
  const expected = Buffer.from(storedHash, 'hex');
  if (derived.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, expected);
}

export function constantTimeStringEquals(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function addDays(base: Date, days: number): Date {
  const result = new Date(base.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function isoDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildSeedDatabase(): LibraryDatabase {
  const now = new Date();
  const dMinus = (days: number) => addDays(now, -days).toISOString();
  const dPlus = (days: number) => addDays(now, days).toISOString();

  const books: Book[] = [
    {
      id: 'bk-001',
      isbn: '978-602-452-101-1',
      title: 'Arsitektur Tropis Nusantara: Dialog Ruang & Cahaya',
      author: 'Ir. Hendra Kusuma, S.T.',
      publisher: 'Pustaka Cipta Mandiri',
      year: 2024,
      category: 'Arsitektur',
      shelfCode: 'A-01',
      totalCopies: 5,
      availableCopies: 3,
      borrowCount: 28,
      coverUrl: '/src/assets/images/book_cover_architecture_1795658108327.jpg',
      synopsis:
        'Kajian mendalam mengenai ventilasi silang, pencahayaan alami, dan material lokal pada bangunan modernis di iklim tropis kepulauan.',
      createdAt: dMinus(45),
      updatedAt: dMinus(2),
    },
    {
      id: 'bk-002',
      isbn: '978-602-452-204-9',
      title: 'Struktur Data & Algoritma Graf Modern',
      author: 'Dr. Nadia Pratiwi',
      publisher: 'Penerbit Informatika Terpadu',
      year: 2025,
      category: 'Teknologi',
      shelfCode: 'T-04',
      totalCopies: 6,
      availableCopies: 4,
      borrowCount: 36,
      coverUrl: '/src/assets/images/book_cover_algorithms_1795658110765.jpg',
      synopsis:
        'Panduan komprehensif optimasi rute, pemrosesan aliran data real-time, dan analisis kompleksitas untuk sistem skala besar.',
      createdAt: dMinus(40),
      updatedAt: dMinus(1),
    },
    {
      id: 'bk-003',
      isbn: '978-602-452-319-0',
      title: 'Atlas Botani Rempah Kepulauan',
      author: 'Prof. Bambang Setyawan',
      publisher: 'Balai Pustaka Ilmiah',
      year: 2023,
      category: 'Botani',
      shelfCode: 'B-02',
      totalCopies: 4,
      availableCopies: 3,
      borrowCount: 19,
      coverUrl: '/src/assets/images/book_cover_botany_1795658109917.jpg',
      synopsis:
        'Dokumentasi taksonomi, ilustrasi ilmiah, serta sebaran ekologis flora aromatik dan tanaman obat endemik Nusantara.',
      createdAt: dMinus(38),
      updatedAt: dMinus(4),
    },
    {
      id: 'bk-004',
      isbn: '978-602-452-412-8',
      title: 'Kartografi Maritim Jalur Rempah Abad XVI',
      author: 'Dra. Ratna Sari Dewi',
      publisher: 'Ombak Sejarah Press',
      year: 2024,
      category: 'Sejarah',
      shelfCode: 'S-03',
      totalCopies: 4,
      availableCopies: 2,
      borrowCount: 24,
      coverUrl: '/src/assets/images/book_cover_maritime_1795658111175.jpg',
      synopsis:
        'Rekonstruksi pelayaran niaga lintas samudra berdasarkan arsip peta pelabuhan, catatan syahbandar, dan instrumen navigasi klasik.',
      createdAt: dMinus(30),
      updatedAt: dMinus(1),
    },
    {
      id: 'bk-005',
      isbn: '978-602-452-508-8',
      title: 'Etika Ruang Publik & Masyarakat Sipil',
      author: 'Dr. Arman Wijaya',
      publisher: 'Nalar Kritis Aksara',
      year: 2025,
      category: 'Filsafat',
      shelfCode: 'F-01',
      totalCopies: 5,
      availableCopies: 4,
      borrowCount: 22,
      coverUrl: '/src/assets/images/book_cover_philosophy_1795658111627.jpg',
      synopsis:
        'Kumpulan esai mengenai demokrasi deliberatif, literasi kewargaan, dan etika teknologi informasi dalam tata kelola kota.',
      createdAt: dMinus(25),
      updatedAt: dMinus(3),
    },
    {
      id: 'bk-006',
      isbn: '978-602-452-615-3',
      title: 'Sistem Terdistribusi & Konsensus Real-Time',
      author: 'Raka Mahendra, M.Kom.',
      publisher: 'Penerbit Informatika Terpadu',
      year: 2025,
      category: 'Teknologi',
      shelfCode: 'T-07',
      totalCopies: 4,
      availableCopies: 3,
      borrowCount: 17,
      coverUrl: '',
      synopsis:
        'Implementasi replikasi state, toleransi kesalahan, dan protokol WebSocket berlatensi rendah untuk aplikasi web modern.',
      createdAt: dMinus(20),
      updatedAt: dMinus(2),
    },
    {
      id: 'bk-007',
      isbn: '978-602-452-721-1',
      title: 'Sejarah Pers & Literasi Kota Lama',
      author: 'Siti Aminah, M.Hum.',
      publisher: 'Ombak Sejarah Press',
      year: 2022,
      category: 'Sejarah',
      shelfCode: 'S-08',
      totalCopies: 3,
      availableCopies: 2,
      borrowCount: 14,
      coverUrl: '',
      synopsis:
        'Menelusuri jaringan percetakan awal, taman bacaan rakyat, dan peran surat kabar daerah dalam membentuk budaya baca modern.',
      createdAt: dMinus(18),
      updatedAt: dMinus(5),
    },
    {
      id: 'bk-008',
      isbn: '978-602-452-830-0',
      title: 'Desain Tipografi & Tata Letak Editorial',
      author: 'Dimas Prasetyo',
      publisher: 'Pustaka Cipta Mandiri',
      year: 2024,
      category: 'Arsitektur',
      shelfCode: 'A-05',
      totalCopies: 4,
      availableCopies: 4,
      borrowCount: 12,
      coverUrl: '',
      synopsis:
        'Prinsip grid modular, hierarki huruf, serta keseimbangan ruang negatif untuk penerbitan buku cetak maupun platform digital.',
      createdAt: dMinus(14),
      updatedAt: dMinus(6),
    },
  ];

  const loans: LoanRecord[] = [
    {
      id: 'ln-001',
      loanCode: 'TRX-2611-001',
      bookId: 'bk-002',
      bookTitle: 'Struktur Data & Algoritma Graf Modern',
      bookAuthor: 'Dr. Nadia Pratiwi',
      bookIsbn: '978-602-452-204-9',
      userId: 'seed-member-1',
      memberName: 'Rina Kartika',
      memberEmail: 'rina.kartika@anggota.aksara.id',
      memberCode: 'MBR-1024',
      borrowedAt: dMinus(11),
      dueAt: dMinus(4),
      returnedAt: null,
      renewCount: 0,
      status: 'overdue',
      fineAmount: 4 * DAILY_FINE_IDR,
    },
    {
      id: 'ln-002',
      loanCode: 'TRX-2611-002',
      bookId: 'bk-001',
      bookTitle: 'Arsitektur Tropis Nusantara: Dialog Ruang & Cahaya',
      bookAuthor: 'Ir. Hendra Kusuma, S.T.',
      bookIsbn: '978-602-452-101-1',
      userId: 'seed-member-2',
      memberName: 'Bagas Pratama',
      memberEmail: 'bagas.pratama@anggota.aksara.id',
      memberCode: 'MBR-1029',
      borrowedAt: dMinus(3),
      dueAt: dPlus(4),
      returnedAt: null,
      renewCount: 0,
      status: 'active',
      fineAmount: 0,
    },
    {
      id: 'ln-003',
      loanCode: 'TRX-2611-003',
      bookId: 'bk-004',
      bookTitle: 'Kartografi Maritim Jalur Rempah Abad XVI',
      bookAuthor: 'Dra. Ratna Sari Dewi',
      bookIsbn: '978-602-452-412-8',
      userId: 'seed-member-3',
      memberName: 'Dewi Anggraini',
      memberEmail: 'dewi.anggraini@anggota.aksara.id',
      memberCode: 'MBR-1033',
      borrowedAt: dMinus(2),
      dueAt: dPlus(5),
      returnedAt: null,
      renewCount: 1,
      status: 'active',
      fineAmount: 0,
    },
    {
      id: 'ln-004',
      loanCode: 'TRX-2611-004',
      bookId: 'bk-005',
      bookTitle: 'Etika Ruang Publik & Masyarakat Sipil',
      bookAuthor: 'Dr. Arman Wijaya',
      bookIsbn: '978-602-452-508-8',
      userId: 'seed-member-1',
      memberName: 'Rina Kartika',
      memberEmail: 'rina.kartika@anggota.aksara.id',
      memberCode: 'MBR-1024',
      borrowedAt: dMinus(1),
      dueAt: dPlus(6),
      returnedAt: null,
      renewCount: 0,
      status: 'active',
      fineAmount: 0,
    },
    {
      id: 'ln-005',
      loanCode: 'TRX-2611-005',
      bookId: 'bk-003',
      bookTitle: 'Atlas Botani Rempah Kepulauan',
      bookAuthor: 'Prof. Bambang Setyawan',
      bookIsbn: '978-602-452-319-0',
      userId: 'seed-member-4',
      memberName: 'Fajar Nugroho',
      memberEmail: 'fajar.nugroho@anggota.aksara.id',
      memberCode: 'MBR-1041',
      borrowedAt: dMinus(6),
      dueAt: dPlus(1),
      returnedAt: dMinus(2),
      renewCount: 0,
      status: 'returned',
      fineAmount: 0,
    },
    {
      id: 'ln-006',
      loanCode: 'TRX-2611-006',
      bookId: 'bk-006',
      bookTitle: 'Sistem Terdistribusi & Konsensus Real-Time',
      bookAuthor: 'Raka Mahendra, M.Kom.',
      bookIsbn: '978-602-452-615-3',
      userId: 'seed-member-2',
      memberName: 'Bagas Pratama',
      memberEmail: 'bagas.pratama@anggota.aksara.id',
      memberCode: 'MBR-1029',
      borrowedAt: dMinus(5),
      dueAt: dPlus(2),
      returnedAt: dMinus(1),
      renewCount: 0,
      status: 'returned',
      fineAmount: 0,
    },
    {
      id: 'ln-007',
      loanCode: 'TRX-2611-007',
      bookId: 'bk-001',
      bookTitle: 'Arsitektur Tropis Nusantara: Dialog Ruang & Cahaya',
      bookAuthor: 'Ir. Hendra Kusuma, S.T.',
      bookIsbn: '978-602-452-101-1',
      userId: 'seed-member-3',
      memberName: 'Dewi Anggraini',
      memberEmail: 'dewi.anggraini@anggota.aksara.id',
      memberCode: 'MBR-1033',
      borrowedAt: dMinus(4),
      dueAt: dPlus(3),
      returnedAt: null,
      renewCount: 0,
      status: 'active',
      fineAmount: 0,
    },
    {
      id: 'ln-008',
      loanCode: 'TRX-2611-008',
      bookId: 'bk-004',
      bookTitle: 'Kartografi Maritim Jalur Rempah Abad XVI',
      bookAuthor: 'Dra. Ratna Sari Dewi',
      bookIsbn: '978-602-452-412-8',
      userId: 'seed-member-4',
      memberName: 'Fajar Nugroho',
      memberEmail: 'fajar.nugroho@anggota.aksara.id',
      memberCode: 'MBR-1041',
      borrowedAt: dMinus(1),
      dueAt: dPlus(6),
      returnedAt: null,
      renewCount: 0,
      status: 'active',
      fineAmount: 0,
    },
    {
      id: 'ln-009',
      loanCode: 'TRX-2611-009',
      bookId: 'bk-007',
      bookTitle: 'Sejarah Pers & Literasi Kota Lama',
      bookAuthor: 'Siti Aminah, M.Hum.',
      bookIsbn: '978-602-452-721-1',
      userId: 'seed-member-1',
      memberName: 'Rina Kartika',
      memberEmail: 'rina.kartika@anggota.aksara.id',
      memberCode: 'MBR-1024',
      borrowedAt: dMinus(3),
      dueAt: dPlus(4),
      returnedAt: null,
      renewCount: 0,
      status: 'active',
      fineAmount: 0,
    },
    {
      id: 'ln-010',
      loanCode: 'TRX-2611-010',
      bookId: 'bk-003',
      bookTitle: 'Atlas Botani Rempah Kepulauan',
      bookAuthor: 'Prof. Bambang Setyawan',
      bookIsbn: '978-602-452-319-0',
      userId: 'seed-member-2',
      memberName: 'Bagas Pratama',
      memberEmail: 'bagas.pratama@anggota.aksara.id',
      memberCode: 'MBR-1029',
      borrowedAt: dMinus(2),
      dueAt: dPlus(5),
      returnedAt: null,
      renewCount: 0,
      status: 'active',
      fineAmount: 0,
    },
    {
      id: 'ln-011',
      loanCode: 'TRX-2611-011',
      bookId: 'bk-002',
      bookTitle: 'Struktur Data & Algoritma Graf Modern',
      bookAuthor: 'Dr. Nadia Pratiwi',
      bookIsbn: '978-602-452-204-9',
      userId: 'seed-member-3',
      memberName: 'Dewi Anggraini',
      memberEmail: 'dewi.anggraini@anggota.aksara.id',
      memberCode: 'MBR-1033',
      borrowedAt: dMinus(0),
      dueAt: dPlus(7),
      returnedAt: null,
      renewCount: 0,
      status: 'active',
      fineAmount: 0,
    },
    {
      id: 'ln-012',
      loanCode: 'TRX-2611-012',
      bookId: 'bk-006',
      bookTitle: 'Sistem Terdistribusi & Konsensus Real-Time',
      bookAuthor: 'Raka Mahendra, M.Kom.',
      bookIsbn: '978-602-452-615-3',
      userId: 'seed-member-4',
      memberName: 'Fajar Nugroho',
      memberEmail: 'fajar.nugroho@anggota.aksara.id',
      memberCode: 'MBR-1041',
      borrowedAt: dMinus(0),
      dueAt: dPlus(7),
      returnedAt: null,
      renewCount: 0,
      status: 'active',
      fineAmount: 0,
    },
  ];

  // Ensure availableCopies matches active/overdue loans cleanly
  for (const book of books) {
    const outCount = loans.filter((l) => l.bookId === book.id && l.status !== 'returned').length;
    book.availableCopies = Math.max(0, book.totalCopies - outCount);
  }

  const activities: ActivityEvent[] = [
    {
      id: 'act-001',
      type: 'loan:created',
      actorName: 'Fajar Nugroho',
      actorRole: 'member',
      summary: 'Meminjam "Sistem Terdistribusi & Konsensus Real-Time"',
      referenceCode: 'TRX-2611-012',
      timestamp: dMinus(0),
    },
    {
      id: 'act-002',
      type: 'loan:created',
      actorName: 'Dewi Anggraini',
      actorRole: 'member',
      summary: 'Meminjam "Struktur Data & Algoritma Graf Modern"',
      referenceCode: 'TRX-2611-011',
      timestamp: dMinus(0),
    },
    {
      id: 'act-003',
      type: 'loan:returned',
      actorName: 'Bagas Pratama',
      actorRole: 'member',
      summary: 'Mengembalikan "Sistem Terdistribusi & Konsensus Real-Time"',
      referenceCode: 'TRX-2611-006',
      timestamp: dMinus(1),
    },
    {
      id: 'act-004',
      type: 'loan:extended',
      actorName: 'Dewi Anggraini',
      actorRole: 'member',
      summary: 'Memperpanjang durasi pinjam "Kartografi Maritim Jalur Rempah Abad XVI"',
      referenceCode: 'TRX-2611-003',
      timestamp: dMinus(1),
    },
    {
      id: 'act-005',
      type: 'loan:returned',
      actorName: 'Fajar Nugroho',
      actorRole: 'member',
      summary: 'Mengembalikan "Atlas Botani Rempah Kepulauan"',
      referenceCode: 'TRX-2611-005',
      timestamp: dMinus(2),
    },
  ];

  const initialDb: LibraryDatabase = {
    users: [],
    books,
    loans,
    activities,
    reports: [],
    reportSchedule: {
      enabled: true,
      frequency: 'mingguan',
      lastAutoRunAt: dMinus(1),
      nextScheduledRunAt: dPlus(6),
    },
  };

  const initialReport = buildReportRecord(initialDb, 'mingguan', 'Sistem Pelaporan Otomatis');
  initialDb.reports.push(initialReport);
  initialDb.activities.unshift({
    id: 'act-000',
    type: 'report:generated',
    actorName: 'Sistem Pelaporan Otomatis',
    actorRole: 'admin',
    summary: `Laporan otomatis mingguan (${initialReport.reportCode}) diterbitkan`,
    referenceCode: initialReport.reportCode,
    timestamp: initialReport.generatedAt,
  });

  return initialDb;
}

export function refreshLoanStatuses(db: LibraryDatabase): boolean {
  let changed = false;
  const now = Date.now();
  for (const loan of db.loans) {
    if (loan.returnedAt) {
      if (loan.status !== 'returned') {
        loan.status = 'returned';
        changed = true;
      }
      continue;
    }
    const dueMs = new Date(loan.dueAt).getTime();
    if (now > dueMs) {
      const daysOverdue = Math.max(1, Math.ceil((now - dueMs) / (1000 * 60 * 60 * 24)));
      const expectedFine = daysOverdue * DAILY_FINE_IDR;
      if (loan.status !== 'overdue' || loan.fineAmount !== expectedFine) {
        loan.status = 'overdue';
        loan.fineAmount = expectedFine;
        changed = true;
      }
    } else if (loan.status !== 'active' || loan.fineAmount !== 0) {
      loan.status = 'active';
      loan.fineAmount = 0;
      changed = true;
    }
  }
  return changed;
}

export function computeStatistics(db: LibraryDatabase): LibraryStatistics {
  refreshLoanStatuses(db);
  const totalTitles = db.books.length;
  const totalCopies = db.books.reduce((sum, b) => sum + b.totalCopies, 0);
  const availableCopies = db.books.reduce((sum, b) => sum + b.availableCopies, 0);
  const activeLoans = db.loans.filter((l) => l.status === 'active').length;
  const overdueLoans = db.loans.filter((l) => l.status === 'overdue').length;
  const returnedLoans = db.loans.filter((l) => l.status === 'returned').length;
  const totalFinesIdr = db.loans.reduce((sum, l) => sum + l.fineAmount, 0);
  const memberIdsFromLoans = new Set(db.loans.map((l) => l.userId));
  const registeredMemberIds = new Set(db.users.filter((u) => u.role === 'member').map((u) => u.id));
  const allMemberIds = new Set([...memberIdsFromLoans, ...registeredMemberIds]);

  const borrowedCopies = Math.max(0, totalCopies - availableCopies);
  const utilizationRate = totalCopies > 0 ? Math.round((borrowedCopies / totalCopies) * 100) : 0;

  const now = new Date();
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const dailyTrends: LibraryStatistics['dailyTrends'] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const day = addDays(now, -offset);
    const key = isoDateKey(day);
    const borrowed = db.loans.filter((l) => l.borrowedAt.slice(0, 10) === key).length;
    const returned = db.loans.filter((l) => l.returnedAt && l.returnedAt.slice(0, 10) === key).length;
    dailyTrends.push({
      date: key,
      label: `${dayNames[day.getDay()]} ${day.getDate()}`,
      borrowed,
      returned,
    });
  }

  const categoryMap = new Map<string, { titles: number; copies: number; borrows: number }>();
  for (const book of db.books) {
    const existing = categoryMap.get(book.category) || { titles: 0, copies: 0, borrows: 0 };
    existing.titles += 1;
    existing.copies += book.totalCopies;
    existing.borrows += book.borrowCount;
    categoryMap.set(book.category, existing);
  }
  const categoryDistribution = Array.from(categoryMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.borrows - a.borrows);

  return {
    totalTitles,
    totalCopies,
    availableCopies,
    activeLoans,
    overdueLoans,
    returnedLoans,
    totalMembers: allMemberIds.size,
    totalFinesIdr,
    utilizationRate,
    dailyTrends,
    categoryDistribution,
  };
}

export function buildReportRecord(
  db: LibraryDatabase,
  scheduleType: AutomatedReport['scheduleType'],
  generatedBy: string
): AutomatedReport {
  const stats = computeStatistics(db);
  const now = new Date();
  const reportIndex = db.reports.length + 1;
  const code = `RPT-${now.toISOString().slice(2, 7).replace('-', '')}-${String(reportIndex).padStart(3, '0')}`;

  const periodLabels: Record<AutomatedReport['scheduleType'], string> = {
    harian: `Laporan Harian (${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })})`,
    mingguan: `Rekap Mingguan (7 Hari Terakhir)`,
    bulanan: `Rekap Bulanan (${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})`,
    manual: `Audit Sirkulasi Eksekutif`,
  };

  const topBooks = [...db.books]
    .sort((a, b) => b.borrowCount - a.borrowCount)
    .slice(0, 5)
    .map((b) => ({
      title: b.title,
      author: b.author,
      category: b.category,
      borrowCount: b.borrowCount,
    }));

  const categoryBreakdown = stats.categoryDistribution.map((c) => ({
    category: c.category,
    titles: c.titles,
    borrows: c.borrows,
  }));

  const overdueNote =
    stats.overdueLoans > 0
      ? `Terdapat ${stats.overdueLoans} peminjaman melewati jatuh tempo dengan akumulasi denda Rp ${stats.totalFinesIdr.toLocaleString('id-ID')}.`
      : 'Seluruh peminjaman aktif berada dalam batas waktu pengembalian normal.';

  return {
    id: `rpt-${crypto.randomUUID().slice(0, 8)}`,
    reportCode: code,
    title: `Laporan Sirkulasi & Koleksi ${code}`,
    periodLabel: periodLabels[scheduleType],
    scheduleType,
    generatedAt: now.toISOString(),
    generatedBy,
    metrics: {
      totalCatalogTitles: stats.totalTitles,
      totalCopies: stats.totalCopies,
      availableCopies: stats.availableCopies,
      activeLoans: stats.activeLoans,
      overdueLoans: stats.overdueLoans,
      returnedLoans: stats.returnedLoans,
      totalTransactions: db.loans.length,
      totalFinesIdr: stats.totalFinesIdr,
      utilizationRatePercent: stats.utilizationRate,
    },
    topBooks,
    categoryBreakdown,
    notes: `${overdueNote} Tingkat pemanfaatan koleksi saat ini mencapai ${stats.utilizationRate}% dari total ${stats.totalCopies} eksemplar.`,
  };
}

export function loadDatabase(): LibraryDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!DB_PATH.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Resolved database path escapes data directory');
  }
  if (!fs.existsSync(DB_PATH)) {
    const seed = buildSeedDatabase();
    saveDatabase(seed);
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as LibraryDatabase;
    refreshLoanStatuses(parsed);
    return parsed;
  } catch {
    const seed = buildSeedDatabase();
    saveDatabase(seed);
    return seed;
  }
}

export function saveDatabase(db: LibraryDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!DB_PATH.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Resolved database path escapes data directory');
  }
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

export function recordActivity(
  db: LibraryDatabase,
  type: ActivityType,
  actorName: string,
  actorRole: UserRole,
  summary: string,
  referenceCode: string
): ActivityEvent {
  const event: ActivityEvent = {
    id: `act-${crypto.randomUUID().slice(0, 8)}`,
    type,
    actorName,
    actorRole,
    summary,
    referenceCode,
    timestamp: new Date().toISOString(),
  };
  db.activities.unshift(event);
  if (db.activities.length > 60) {
    db.activities = db.activities.slice(0, 60);
  }
  return event;
}
