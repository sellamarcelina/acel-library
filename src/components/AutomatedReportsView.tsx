import { useEffect, useState } from 'react';
import { Calendar, Download, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react';
import type { AutomatedReport } from '../types.ts';

interface ReportScheduleState {
  enabled: boolean;
  frequency: 'harian' | 'mingguan' | 'bulanan';
  lastAutoRunAt: string | null;
  nextScheduledRunAt: string;
}

interface AutomatedReportsViewProps {
  token: string;
  reports: AutomatedReport[];
  onGenerateReport: (scheduleType: AutomatedReport['scheduleType']) => Promise<{ ok: boolean; error?: string }>;
}

export function AutomatedReportsView({
  token,
  reports,
  onGenerateReport,
}: AutomatedReportsViewProps) {
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id || '');
  const [schedule, setSchedule] = useState<ReportScheduleState>({
    enabled: true,
    frequency: 'mingguan',
    lastAutoRunAt: null,
    nextScheduledRunAt: new Date().toISOString(),
  });
  const [generating, setGenerating] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [manualPeriod, setManualPeriod] = useState<AutomatedReport['scheduleType']>('manual');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!selectedReportId && reports.length > 0) {
      setSelectedReportId(reports[0].id);
    }
  }, [reports, selectedReportId]);

  useEffect(() => {
    let active = true;
    fetch('/api/reports/schedule', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.schedule) {
          setSchedule(data.schedule);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token]);

  const activeReport = reports.find((r) => r.id === selectedReportId) || reports[0] || null;

  async function handleGenerateNow() {
    setGenerating(true);
    setFeedback(null);
    const res = await onGenerateReport(manualPeriod);
    setGenerating(false);
    if (res.ok) {
      setFeedback({ type: 'success', text: 'Laporan otomatis terbaru berhasil diterbitkan dan diarsipkan.' });
    } else {
      setFeedback({ type: 'error', text: res.error || 'Gagal membuat laporan.' });
    }
  }

  async function handleUpdateSchedule(nextEnabled: boolean, nextFreq: ReportScheduleState['frequency']) {
    setSavingSchedule(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/reports/schedule', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: nextEnabled, frequency: nextFreq }),
      });
      const data = await res.json();
      if (res.ok && data.schedule) {
        setSchedule(data.schedule);
        setFeedback({
          type: 'success',
          text: nextEnabled
            ? `Pelaporan otomatis dijadwalkan setiap periode ${nextFreq}.`
            : 'Penjadwalan otomatis dinonaktifkan.',
        });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Gagal menyimpan konfigurasi jadwal.' });
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleDownloadCsv(report: AutomatedReport) {
    setDownloading(true);
    try {
      const res = await fetch(`/api/reports/${report.id}/csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setFeedback({ type: 'error', text: 'Gagal mengunduh berkas CSV.' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${report.reportCode}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Automated Scheduler & Instant Generator Bar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Penjadwalan Pelaporan Otomatis
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Server secara otomatis merekam snapshot sirkulasi dan keterlambatan sesuai interval aktif
              </p>
            </div>
            <button
              type="button"
              disabled={savingSchedule}
              onClick={() => handleUpdateSchedule(!schedule.enabled, schedule.frequency)}
              className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                schedule.enabled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {schedule.enabled ? 'Penjadwalan Aktif' : 'Penjadwalan Nonaktif'}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['harian', 'mingguan', 'bulanan'] as const).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  disabled={savingSchedule}
                  onClick={() => handleUpdateSchedule(schedule.enabled, freq)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                    schedule.frequency === freq
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {freq}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Jadwal berikutnya:{' '}
                <strong className="font-mono text-slate-800 tabular-nums">
                  {new Date(schedule.nextScheduledRunAt).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Terbitkan Laporan Instan
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Hasilkan kompilasi data real-time kapan saja untuk kebutuhan audit
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <select
              value={manualPeriod}
              onChange={(e) => setManualPeriod(e.target.value as AutomatedReport['scheduleType'])}
              aria-label="Pilih jenis periode laporan"
              className="flex-1 min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-teal-700 focus:outline-none"
            >
              <option value="manual">Audit Sirkulasi Eksekutif</option>
              <option value="harian">Rekap Harian</option>
              <option value="mingguan">Rekap Mingguan</option>
              <option value="bulanan">Rekap Bulanan</option>
            </select>

            <button
              type="button"
              disabled={generating}
              onClick={handleGenerateNow}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white whitespace-nowrap hover:bg-[#115E59] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} aria-hidden="true" />
              {generating ? 'Menyusun...' : 'Buat Laporan'}
            </button>
          </div>
        </section>
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
          <button type="button" onClick={() => setFeedback(null)} className="text-xs font-medium underline">
            Tutup
          </button>
        </div>
      )}

      {/* Report Archive List & Full Preview */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <aside className="rounded-xl border border-slate-200 bg-white xl:col-span-4">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Arsip Laporan Terbit ({reports.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
            {reports.map((report) => {
              const selected = activeReport?.id === report.id;
              return (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setSelectedReportId(report.id)}
                  className={`w-full px-5 py-3.5 text-left transition-colors ${
                    selected ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-slate-800 tabular-nums">
                      {report.reportCode}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {new Date(report.generatedAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-800">{report.periodLabel}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Oleh {report.generatedBy}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white xl:col-span-8">
          {!activeReport ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              Pilih atau terbitkan laporan untuk melihat rincian analitik.
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="font-mono text-xs text-slate-500 tabular-nums">
                    {activeReport.reportCode} · Diterbitkan{' '}
                    {new Date(activeReport.generatedAt).toLocaleString('id-ID')}
                  </p>
                  <h3 className="mt-0.5 font-display text-lg font-semibold text-slate-900">
                    {activeReport.periodLabel}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={downloading}
                    onClick={() => handleDownloadCsv(activeReport)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 whitespace-nowrap hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Unduh CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap hover:bg-[#115E59]"
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                    Cetak Ringkasan
                  </button>
                </div>
              </div>

              <div className="space-y-6 p-6">
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <FileSpreadsheet className="h-4 w-4 text-teal-800" aria-hidden="true" />
                    Ringkasan Eksekutif Otomatis
                  </p>
                  <p className="mt-1.5 leading-relaxed">{activeReport.notes}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-xs text-slate-500">Total Judul</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                      {activeReport.metrics.totalCatalogTitles}
                    </p>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-xs text-slate-500">Utilisasi Koleksi</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-teal-800 tabular-nums">
                      {activeReport.metrics.utilizationRatePercent}%
                    </p>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-xs text-slate-500">Pinjam Aktif / Telat</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                      {activeReport.metrics.activeLoans} /{' '}
                      <span className={activeReport.metrics.overdueLoans > 0 ? 'text-red-700' : ''}>
                        {activeReport.metrics.overdueLoans}
                      </span>
                    </p>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-xs text-slate-500">Akumulasi Denda</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                      Rp {activeReport.metrics.totalFinesIdr.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-display text-sm font-semibold text-slate-900">
                    5 Koleksi dengan Peminjaman Tertinggi
                  </h4>
                  <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="px-4 py-2.5 font-medium">Judul Buku</th>
                          <th className="px-4 py-2.5 font-medium">Penulis</th>
                          <th className="px-4 py-2.5 font-medium">Kategori</th>
                          <th className="px-4 py-2.5 text-right font-medium">Frekuensi Pinjam</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeReport.topBooks.map((item) => (
                          <tr key={item.title}>
                            <td className="px-4 py-2.5 font-medium text-slate-900">{item.title}</td>
                            <td className="px-4 py-2.5 text-slate-600">{item.author}</td>
                            <td className="px-4 py-2.5 text-slate-600">{item.category}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-slate-900 tabular-nums">
                              {item.borrowCount}x
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
