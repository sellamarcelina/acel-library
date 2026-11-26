import { useState } from 'react';
import type { LibraryStatistics } from '../types.ts';

interface CirculationTrendChartProps {
  data: LibraryStatistics['dailyTrends'];
}

export function CirculationTrendChart({ data }: CirculationTrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = Math.max(
    4,
    ...data.map((d) => Math.max(d.borrowed, d.returned))
  );
  const yMax = Math.ceil(maxVal / 2) * 2;
  const chartHeight = 190;
  const chartWidth = 560;
  const padLeft = 34;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 32;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = chartHeight - padTop - padBottom;
  const slotW = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.min(18, Math.max(10, slotW * 0.24));

  const ticks = [0, Math.round(yMax / 2), yMax];

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900">
            Tren Sirkulasi 7 Hari Terakhir
          </h3>
          <p className="text-xs text-slate-500">
            Perbandingan volume peminjaman dan pengembalian harian
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#0F766E]" aria-hidden="true" />
            Peminjaman
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#94A3B8]" aria-hidden="true" />
            Pengembalian
          </span>
        </div>
      </div>

      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-52 w-full overflow-visible"
          role="img"
          aria-label="Grafik tren peminjaman dan pengembalian 7 hari terakhir"
        >
          {ticks.map((tick) => {
            const y = padTop + plotH - (tick / yMax) * plotH;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  x2={chartWidth - padRight}
                  y1={y}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray={tick === 0 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 font-mono text-[10px] tabular-nums"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {data.map((item, idx) => {
            const groupCenterX = padLeft + idx * slotW + slotW / 2;
            const borrowH = (item.borrowed / yMax) * plotH;
            const returnH = (item.returned / yMax) * plotH;
            const borrowY = padTop + plotH - borrowH;
            const returnY = padTop + plotH - returnH;
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={item.date}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {isHovered && (
                  <rect
                    x={padLeft + idx * slotW + 2}
                    y={padTop}
                    width={Math.max(0, slotW - 4)}
                    height={plotH}
                    rx={4}
                    fill="#F1F5F9"
                  />
                )}
                <rect
                  x={groupCenterX - barW - 2}
                  y={borrowY}
                  width={barW}
                  height={Math.max(2, borrowH)}
                  rx={2}
                  fill={isHovered ? '#115E59' : '#0F766E'}
                />
                <rect
                  x={groupCenterX + 2}
                  y={returnY}
                  width={barW}
                  height={Math.max(2, returnH)}
                  rx={2}
                  fill={isHovered ? '#64748B' : '#94A3B8'}
                />
                <text
                  x={groupCenterX}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  className="fill-slate-500 font-mono text-[10px] tabular-nums"
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-600">
            <span className="font-medium text-slate-800">{data[hoveredIdx].label}</span>
            <span className="font-mono tabular-nums">
              Pinjam: <strong className="text-teal-800">{data[hoveredIdx].borrowed}</strong> · Kembali:{' '}
              <strong className="text-slate-700">{data[hoveredIdx].returned}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface CategoryBreakdownChartProps {
  categories: LibraryStatistics['categoryDistribution'];
}

export function CategoryBreakdownChart({ categories }: CategoryBreakdownChartProps) {
  const maxBorrows = Math.max(1, ...categories.map((c) => c.borrows));
  const totalBorrows = categories.reduce((sum, c) => sum + c.borrows, 0);

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="font-display text-base font-semibold text-slate-900">
          Distribusi Peminjaman per Kategori
        </h3>
        <p className="text-xs text-slate-500">
          Akumulasi transaksi historis berdasarkan bidang keilmuan
        </p>
      </div>

      {categories.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Belum ada data kategori koleksi.</p>
      ) : (
        <div className="space-y-3.5">
          {categories.map((cat) => {
            const widthPct = Math.max(6, Math.round((cat.borrows / maxBorrows) * 100));
            const sharePct = totalBorrows > 0 ? Math.round((cat.borrows / totalBorrows) * 100) : 0;
            return (
              <div key={cat.category} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-slate-800 truncate">{cat.category}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 tabular-nums whitespace-nowrap">
                      {cat.titles} judul / {cat.copies} eks
                    </span>
                  </div>
                  <span className="font-mono text-slate-700 tabular-nums whitespace-nowrap">
                    {cat.borrows}x ({sharePct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-sm bg-slate-100">
                  <div
                    className="h-full rounded-sm bg-[#0F766E] transition-all duration-300"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
