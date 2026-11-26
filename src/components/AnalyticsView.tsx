import { Wifi } from 'lucide-react';
import type { ActivityEvent, LibraryStatistics } from '../types.ts';
import { CategoryBreakdownChart, CirculationTrendChart } from './Charts.tsx';

interface AnalyticsViewProps {
  stats: LibraryStatistics;
  activities: ActivityEvent[];
  onlineConnections: number;
  wsConnected: boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AnalyticsView({
  stats,
  activities,
  onlineConnections,
  wsConnected,
}: AnalyticsViewProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-7">
          <CirculationTrendChart data={stats.dailyTrends} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-5">
          <CategoryBreakdownChart categories={stats.categoryDistribution} />
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Aliran Aktivitas Sirkulasi Real-Time
            </h3>
            <p className="text-xs text-slate-500">
              Pembaruan otomatis aktivitas peminjaman, pengembalian, dan pembaruan katalog
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-slate-600">
            <Wifi
              className={`h-3.5 w-3.5 ${wsConnected ? 'text-emerald-700' : 'text-amber-600'}`}
              aria-hidden="true"
            />
            <span>{wsConnected ? 'Sinkronisasi Real-Time' : 'Menghubungkan ulang...'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{onlineConnections} terhubung</span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {activities.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">
              Belum ada aktivitas sirkulasi tercatat.
            </p>
          ) : (
            activities.slice(0, 12).map((act) => (
              <div
                key={act.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 text-sm hover:bg-slate-50/70"
              >
                <div className="min-w-0">
                  <p className="text-slate-900">
                    <span className="font-medium">{act.actorName}</span>{' '}
                    <span className="text-slate-600">{act.summary}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                  <span>{act.referenceCode}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatTime(act.timestamp)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
