import { useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, RotateCcw, Clock } from 'lucide-react';
import type { LoanRecord, UserSession } from '../types.ts';

interface MemberDashboardProps {
  user: UserSession;
  loans: LoanRecord[];
  onReturnLoan: (loanId: string) => Promise<{ ok: boolean; error?: string }>;
  onExtendLoan: (loanId: string) => Promise<{ ok: boolean; error?: string }>;
  onGoToCatalog: () => void;
}

function formatIdDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getRemainingDaysLabel(dueAt: string): { label: string; urgent: boolean } {
  const diffMs = new Date(dueAt).getTime() - Date.now();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) {
    return { label: `Terlambat ${Math.abs(days)} hari`, urgent: true };
  }
  if (days === 0) {
    return { label: 'Jatuh tempo hari ini', urgent: true };
  }
  if (days <= 2) {
    return { label: `Sisa ${days} hari`, urgent: true };
  }
  return { label: `Sisa ${days} hari`, urgent: false };
}

export function MemberDashboard({
  user,
  loans,
  onReturnLoan,
  onExtendLoan,
  onGoToCatalog,
}: MemberDashboardProps) {
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'active' | 'returned'>('all');

  const activeLoans = useMemo(() => loans.filter((l) => l.status !== 'returned'), [loans]);
  const overdueCount = useMemo(() => loans.filter((l) => l.status === 'overdue').length, [loans]);
  const totalFines = useMemo(() => loans.reduce((sum, l) => sum + l.fineAmount, 0), [loans]);

  const filteredLoans = useMemo(() => {
    if (historyFilter === 'active') return loans.filter((l) => l.status !== 'returned');
    if (historyFilter === 'returned') return loans.filter((l) => l.status === 'returned');
    return loans;
  }, [loans, historyFilter]);

  async function handleAction(loanId: string, action: 'return' | 'extend') {
    setBusyLoanId(loanId);
    setStatusMessage(null);
    const res = action === 'return' ? await onReturnLoan(loanId) : await onExtendLoan(loanId);
    setBusyLoanId(null);

    if (res.ok) {
      setStatusMessage({
        type: 'success',
        text:
          action === 'return'
            ? 'Buku berhasil dikembalikan dan stok koleksi langsung diperbarui.'
            : 'Durasi peminjaman berhasil diperpanjang 7 hari.',
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Terjadi kendala saat memperbarui transaksi.',
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Member Identity & Personal KPI Strip */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs text-slate-500">
              Kartu Anggota Digital · <span className="font-mono text-slate-700">{user.memberCode}</span>
            </p>
            <h2 className="mt-0.5 font-display text-lg font-semibold text-slate-900">{user.name}</h2>
          </div>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white whitespace-nowrap hover:bg-[#115E59]"
          >
            Pinjam Buku dari Katalog
          </button>
        </div>

        <div className="grid grid-cols-2 divide-y divide-slate-200 sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          <div className="p-5">
            <p className="text-xs text-slate-500">Sedang Dipinjam</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {activeLoans.length}
              <span className="ml-1.5 text-xs font-normal text-slate-400">/ 5 maks</span>
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs text-slate-500">Melewati Tenggat</p>
            <p
              className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
                overdueCount > 0 ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              {overdueCount}
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs text-slate-500">Total Riwayat Pinjam</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">{loans.length}</p>
          </div>
          <div className="p-5">
            <p className="text-xs text-slate-500">Akumulasi Denda</p>
            <p
              className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
                totalFines > 0 ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              Rp {totalFines.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </section>

      {statusMessage && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            statusMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-medium underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Active Loans Section */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Peminjaman Aktif & Riwayat Transaksi
            </h3>
            <p className="text-xs text-slate-500">
              Pantau tenggat pengembalian, lakukan perpanjangan (+7 hari), atau kembalikan buku secara real-time
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'active', label: 'Aktif' },
              { id: 'returned', label: 'Selesai' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHistoryFilter(tab.id as 'all' | 'active' | 'returned')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  historyFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredLoans.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-800">Belum ada transaksi peminjaman</p>
            <p className="mt-1 text-xs text-slate-500">
              Jelajahi Katalog Koleksi untuk meminjam buku digital atau fisik pertama Anda.
            </p>
            <button
              type="button"
              onClick={onGoToCatalog}
              className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Buka Katalog Koleksi
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 pl-6 pr-3">Kode Transaksi</th>
                  <th className="px-3 py-3">Judul Buku</th>
                  <th className="px-3 py-3">Tanggal Pinjam</th>
                  <th className="px-3 py-3">Jatuh Tempo</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Denda</th>
                  <th className="py-3 pl-3 pr-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLoans.map((loan) => {
                  const dueInfo = getRemainingDaysLabel(loan.dueAt);
                  const isBusy = busyLoanId === loan.id;
                  const canExtend = loan.status === 'active' && loan.renewCount < 2;

                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 pl-6 pr-3 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {loan.loanCode}
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="font-medium text-slate-900">{loan.bookTitle}</p>
                        <p className="text-xs text-slate-500">
                          {loan.bookAuthor} · <span className="font-mono">{loan.bookIsbn}</span>
                        </p>
                      </td>
                      <td className="px-3 py-3.5 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatIdDate(loan.borrowedAt)}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <p className="font-mono text-xs text-slate-800 tabular-nums">{formatIdDate(loan.dueAt)}</p>
                        {loan.status !== 'returned' && (
                          <p
                            className={`text-[11px] tabular-nums ${
                              dueInfo.urgent ? 'font-medium text-amber-700' : 'text-slate-500'
                            }`}
                          >
                            {dueInfo.label}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        {loan.status === 'returned' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Dikembalikan
                          </span>
                        ) : loan.status === 'overdue' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            Terlambat
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            Dipinjam ({loan.renewCount}/2 perpanjangan)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono text-xs text-slate-800 tabular-nums whitespace-nowrap">
                        Rp {loan.fineAmount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                        {loan.status !== 'returned' ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={!canExtend || isBusy}
                              onClick={() => handleAction(loan.id, 'extend')}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                              title={
                                loan.status === 'overdue'
                                  ? 'Hubungi Admin untuk perpanjangan buku terlambat'
                                  : loan.renewCount >= 2
                                  ? 'Maksimal 2 kali perpanjangan'
                                  : 'Perpanjang 7 hari'
                              }
                            >
                              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                              Perpanjang
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAction(loan.id, 'return')}
                              className="inline-flex items-center gap-1 rounded-md bg-[#0F766E] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                              Kembalikan
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-slate-400 tabular-nums">
                            {loan.returnedAt ? formatIdDate(loan.returnedAt) : 'Selesai'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
