import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Plus,
  RotateCcw,
  Search,
  Wifi,
} from 'lucide-react';
import type { ActivityEvent, Book, LibraryStatistics, LoanRecord } from '../types.ts';
import { CirculationTrendChart, CategoryBreakdownChart } from './Charts.tsx';

interface AdminDashboardProps {
  books: Book[];
  loans: LoanRecord[];
  activities: ActivityEvent[];
  stats: LibraryStatistics;
  onlineConnections: number;
  wsConnected: boolean;
  onReturnLoan: (loanId: string) => Promise<{ ok: boolean; error?: string }>;
  onExtendLoan: (loanId: string) => Promise<{ ok: boolean; error?: string }>;
  onCreateLoan: (
    bookId: string,
    durationDays: number,
    memberEmail?: string
  ) => Promise<{ ok: boolean; error?: string }>;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminDashboard({
  books,
  loans,
  activities,
  stats,
  onlineConnections,
  wsConnected,
  onReturnLoan,
  onExtendLoan,
  onCreateLoan,
}: AdminDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'overdue' | 'returned'>('all');
  const [search, setSearch] = useState('');
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showQuickLoanModal, setShowQuickLoanModal] = useState(false);
  const [quickBookId, setQuickBookId] = useState(books.find((b) => b.availableCopies > 0)?.id || '');
  const [quickMemberEmail, setQuickMemberEmail] = useState('');
  const [quickDuration, setQuickDuration] = useState(7);
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  const filteredLoans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return loans.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        l.loanCode.toLowerCase().includes(q) ||
        l.memberName.toLowerCase().includes(q) ||
        l.memberEmail.toLowerCase().includes(q) ||
        l.memberCode.toLowerCase().includes(q) ||
        l.bookTitle.toLowerCase().includes(q)
      );
    });
  }, [loans, statusFilter, search]);

  async function handleLoanAction(loanId: string, action: 'return' | 'extend') {
    setBusyLoanId(loanId);
    setFeedback(null);
    const res = action === 'return' ? await onReturnLoan(loanId) : await onExtendLoan(loanId);
    setBusyLoanId(null);
    setFeedback(
      res.ok
        ? {
            type: 'success',
            text:
              action === 'return'
                ? 'Pengembalian berhasil dicatat.'
                : 'Perpanjangan durasi (+7 hari) berhasil diproses.',
          }
        : { type: 'error', text: res.error || 'Gagal memperbarui transaksi.' }
    );
  }

  async function handleQuickLoanSubmit(e: FormEvent) {
    e.preventDefault();
    if (!quickBookId) return;
    setQuickSubmitting(true);
    setFeedback(null);
    const res = await onCreateLoan(quickBookId, quickDuration, quickMemberEmail.trim() || undefined);
    setQuickSubmitting(false);

    if (res.ok) {
      setShowQuickLoanModal(false);
      setQuickMemberEmail('');
      setFeedback({ type: 'success', text: 'Transaksi peminjaman baru berhasil dicatat.' });
    } else {
      setFeedback({ type: 'error', text: res.error || 'Gagal mencatat transaksi peminjaman.' });
    }
  }

  return (
    <div className="space-y-6">
      {/* Real-time Analytics Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-7">
          <CirculationTrendChart data={stats.dailyTrends} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-5">
          <CategoryBreakdownChart categories={stats.categoryDistribution} />
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-medium underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Real-time Transaction Monitor + Live Activity Stream */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Pemantauan Transaksi Sirkulasi
              </h3>
              <p className="text-xs text-slate-500">
                Kelola peminjaman aktif, denda keterlambatan, dan konfirmasi pengembalian buku
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setQuickBookId(books.find((b) => b.availableCopies > 0)?.id || '');
                setShowQuickLoanModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap hover:bg-[#115E59]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Catat Peminjaman
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-3">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode TRX, anggota, atau buku..."
                aria-label="Cari transaksi peminjaman"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {[
                { id: 'all', label: 'Semua' },
                { id: 'active', label: 'Aktif' },
                { id: 'overdue', label: 'Terlambat' },
                { id: 'returned', label: 'Selesai' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id as 'all' | 'active' | 'overdue' | 'returned')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pl-6 pr-3">Kode</th>
                  <th className="px-3 py-2.5">Anggota</th>
                  <th className="px-3 py-2.5">Koleksi Buku</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Denda</th>
                  <th className="py-2.5 pl-3 pr-6 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-xs text-slate-500">
                      Tidak ada transaksi yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map((loan) => {
                    const isBusy = busyLoanId === loan.id;
                    return (
                      <tr key={loan.id} className="hover:bg-slate-50/70">
                        <td className="py-3 pl-6 pr-3 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {loan.loanCode}
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-xs font-medium text-slate-900">{loan.memberName}</p>
                          <p className="font-mono text-[11px] text-slate-500">{loan.memberCode}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-xs font-medium text-slate-900 line-clamp-1">{loan.bookTitle}</p>
                          <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                            Tempo {new Date(loan.dueAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                          </p>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {loan.status === 'returned' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Selesai
                            </span>
                          ) : loan.status === 'overdue' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              Terlambat
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-800">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              Aktif
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-slate-800 tabular-nums whitespace-nowrap">
                          Rp {loan.fineAmount.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 pl-3 pr-6 text-right whitespace-nowrap">
                          {loan.status !== 'returned' ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isBusy || loan.renewCount >= 2}
                                onClick={() => handleLoanAction(loan.id, 'extend')}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45"
                                title="Perpanjang +7 hari"
                              >
                                <CalendarClock className="h-3 w-3" aria-hidden="true" />
                                +7h
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleLoanAction(loan.id, 'return')}
                                className="inline-flex items-center gap-1 rounded-md bg-[#0F766E] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
                              >
                                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                                Kembali
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                              {loan.returnedAt
                                ? new Date(loan.returnedAt).toLocaleDateString('id-ID', {
                                    day: '2-digit',
                                    month: 'short',
                                  })
                                : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Live WebSocket Activity Stream */}
        <aside className="flex flex-col rounded-xl border border-slate-200 bg-white xl:col-span-4">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Aktivitas Transaksi Live
              </h3>
              <p className="text-xs text-slate-500">
                Pembaruan otomatis melalui koneksi WebSocket server
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <Wifi
                className={`h-3.5 w-3.5 ${wsConnected ? 'text-emerald-700' : 'text-amber-600'}`}
                aria-hidden="true"
              />
              <span className="font-mono tabular-nums">{onlineConnections} sesi</span>
            </div>
          </div>

          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[540px]">
            {activities.length === 0 ? (
              <p className="px-5 py-10 text-center text-xs text-slate-500">
                Belum ada aktivitas transaksi tercatat.
              </p>
            ) : (
              activities.slice(0, 18).map((act) => (
                <div key={act.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-800">{act.actorName}</span>
                    <span className="font-mono tabular-nums">{formatDateTime(act.timestamp)}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{act.summary}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">{act.referenceCode}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Quick Admin Loan Creation Modal */}
      {showQuickLoanModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-loan-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 id="quick-loan-title" className="font-display text-base font-semibold text-slate-900">
                Catat Transaksi Peminjaman Baru
              </h3>
              <p className="text-xs text-slate-500">
                Buat transaksi sirkulasi atas nama anggota terdaftar atau akun Anda sendiri
              </p>
            </div>
            <form onSubmit={handleQuickLoanSubmit} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="quick-book" className="block text-xs font-medium text-slate-700">
                  Pilih Judul Buku
                </label>
                <select
                  id="quick-book"
                  required
                  value={quickBookId}
                  onChange={(e) => setQuickBookId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                >
                  <option value="" disabled>
                    -- Pilih Buku Tersedia --
                  </option>
                  {books
                    .filter((b) => b.availableCopies > 0)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} ({b.availableCopies} tersedia)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="quick-member-email" className="block text-xs font-medium text-slate-700">
                  Email Anggota (Opsional — kosongkan untuk akun Admin)
                </label>
                <input
                  id="quick-member-email"
                  type="email"
                  value={quickMemberEmail}
                  onChange={(e) => setQuickMemberEmail(e.target.value)}
                  placeholder="anggota@email.com"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700">Durasi Peminjaman</span>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {[3, 7, 14].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setQuickDuration(d)}
                      className={`rounded-lg border py-2 text-xs font-medium tabular-nums ${
                        quickDuration === d
                          ? 'border-teal-700 bg-teal-50 text-teal-800'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {d} Hari
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickLoanModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={quickSubmitting || !quickBookId}
                  className="rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
                >
                  {quickSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
