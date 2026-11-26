import { useEffect, useState, type FormEvent } from 'react';
import { X, ShieldCheck, UserCheck, UserPlus } from 'lucide-react';
import type { UserSession } from '../types.ts';

interface AuthModalProps {
  open: boolean;
  initialTab?: 'member-login' | 'member-register' | 'admin';
  adminConfigured: boolean;
  adminPasscodeManagedByEnv: boolean;
  onClose: () => void;
  onAuthenticated: (token: string, user: UserSession) => void;
}

export function AuthModal({
  open,
  initialTab = 'member-login',
  adminConfigured,
  adminPasscodeManagedByEnv,
  onClose,
  onAuthenticated,
}: AuthModalProps) {
  const [tab, setTab] = useState<'member-login' | 'member-register' | 'admin'>(initialTab);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setError(null);
    }
  }, [open, initialTab]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const isFirstRunAdminSetup = tab === 'admin' && !adminConfigured && !adminPasscodeManagedByEnv;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let endpoint = '/api/auth/login';
      let payload: Record<string, string> = { email, password, role: tab === 'admin' ? 'admin' : 'member' };

      if (tab === 'member-register') {
        endpoint = '/api/auth/register';
        payload = { name, email, password };
      } else if (isFirstRunAdminSetup) {
        endpoint = '/api/auth/setup-admin';
        payload = { name, email, password };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Autentikasi gagal. Periksa kembali data Anda.');
        setLoading(false);
        return;
      }

      onAuthenticated(data.token, data.user);
      setName('');
      setEmail('');
      setPassword('');
      onClose();
    } catch {
      setError('Gagal terhubung ke server. Coba beberapa saat lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="auth-modal-title" className="font-display text-lg font-semibold text-slate-900">
              Akses Akun Aksara Pustaka
            </h2>
            <p className="text-xs text-slate-500">
              Masuk sebagai Anggota untuk meminjam atau sebagai Admin Pustakawan
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            aria-label="Tutup jendela akses"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-200 px-6 pt-3 pb-3">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setTab('member-login');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                tab === 'member-login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Masuk Member
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('member-register');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                tab === 'member-register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Daftar Baru
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('admin');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                tab === 'admin' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Portal Admin
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {isFirstRunAdminSetup && (
            <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-3 text-xs text-teal-900">
              <p className="font-semibold">Aktivasi Akun Admin Pertama Kali</p>
              <p className="mt-1 text-teal-800">
                Belum ada akun Admin yang terdaftar. Tetapkan kredensial Admin pertama Anda di bawah ini—rute aktivasi akan otomatis dikunci setelah selesai.
              </p>
            </div>
          )}

          {tab === 'admin' && adminPasscodeManagedByEnv && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-medium">Otentikasi Admin Terkelola Server</p>
              <p className="mt-0.5 text-slate-500">
                Masukkan kode akses <code className="font-mono text-slate-800">ADMIN_PASSCODE</code> yang dikonfigurasi pada environment server.
              </p>
            </div>
          )}

          {(tab === 'member-register' || isFirstRunAdminSetup) && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-medium text-slate-700">
                Nama Lengkap
              </label>
              <input
                id="auth-name"
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isFirstRunAdminSetup ? 'Mis. Pustakawan Kepala' : 'Mis. Andi Saputra'}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
              />
            </div>
          )}

          {!(tab === 'admin' && adminPasscodeManagedByEnv) && (
            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-slate-700">
                Alamat Email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={tab === 'admin' ? 'admin@aksarapustaka.id' : 'nama@email.com'}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-slate-700">
              {tab === 'admin' && adminPasscodeManagedByEnv ? 'Kode Akses Admin' : 'Kata Sandi'}
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={isFirstRunAdminSetup ? 8 : tab === 'member-register' ? 6 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                isFirstRunAdminSetup
                  ? 'Minimal 8 karakter'
                  : tab === 'member-register'
                  ? 'Minimal 6 karakter'
                  : 'Masukkan kata sandi'
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
            />
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#0F766E] px-5 py-2 text-xs font-semibold text-white hover:bg-[#115E59] disabled:opacity-60"
            >
              {loading
                ? 'Memproses...'
                : isFirstRunAdminSetup
                ? 'Aktifkan Akun Admin'
                : tab === 'member-register'
                ? 'Daftar & Masuk'
                : tab === 'admin'
                ? 'Masuk sebagai Admin'
                : 'Masuk sebagai Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
