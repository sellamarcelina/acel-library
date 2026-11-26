import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

interface MemberRow {
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

interface MembersDirectoryProps {
  token: string;
  refreshTrigger: number;
}

export function MembersDirectory({ token, refreshTrigger }: MembersDirectoryProps) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/members', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.members) {
          setMembers(data.members);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, refreshTrigger]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900">
            Direktori Anggota & Beban Sirkulasi
          </h3>
          <p className="text-xs text-slate-500">
            Daftar anggota aktif, status pinjaman berjalan, dan catatan denda
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-600 tabular-nums">
          <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
          {members.length} anggota
        </span>
      </div>

      {loading ? (
        <div className="space-y-3 p-6">
          <div className="h-9 w-full rounded bg-slate-100" />
          <div className="h-9 w-full rounded bg-slate-100" />
          <div className="h-9 w-full rounded bg-slate-100" />
        </div>
      ) : members.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-slate-500">
          Belum ada data anggota perpustakaan.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 pl-6 pr-3">Kode Anggota</th>
                <th className="px-3 py-3">Nama Lengkap</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3 text-right">Aktif</th>
                <th className="px-3 py-3 text-right">Terlambat</th>
                <th className="px-3 py-3 text-right">Total Pinjam</th>
                <th className="py-3 pl-3 pr-6 text-right">Total Denda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70">
                  <td className="py-3 pl-6 pr-3 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {m.memberCode}
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-900 whitespace-nowrap">{m.name}</td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{m.email}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-slate-800 tabular-nums">
                    {m.activeLoans}
                  </td>
                  <td
                    className={`px-3 py-3 text-right font-mono text-xs tabular-nums ${
                      m.overdueLoans > 0 ? 'font-semibold text-red-700' : 'text-slate-500'
                    }`}
                  >
                    {m.overdueLoans}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                    {m.totalLoans}
                  </td>
                  <td className="py-3 pl-3 pr-6 text-right font-mono text-xs text-slate-900 tabular-nums whitespace-nowrap">
                    Rp {m.totalFinesIdr.toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
