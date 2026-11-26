import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  BookCopy,
  BookOpen,
  FileSpreadsheet,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  ShieldCheck,
  UserCheck,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import type { AutomatedReport, Book, BootstrapState, UserSession } from './types.ts';
import { AuthModal } from './components/AuthModal.tsx';
import { CatalogView } from './components/CatalogView.tsx';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { MemberDashboard } from './components/MemberDashboard.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { CollectionManager } from './components/CollectionManager.tsx';
import { AutomatedReportsView } from './components/AutomatedReportsView.tsx';
import { MembersDirectory } from './components/MembersDirectory.tsx';

type NavTab =
  | 'catalog'
  | 'analytics'
  | 'member-dashboard'
  | 'admin-dashboard'
  | 'collections'
  | 'reports'
  | 'members';

const TAB_LABELS: Record<NavTab, string> = {
  catalog: 'Katalog Koleksi',
  analytics: 'Statistik & Tren',
  'member-dashboard': 'Dashboard Member',
  'admin-dashboard': 'Dashboard Admin',
  collections: 'Manajemen Koleksi',
  reports: 'Pelaporan Otomatis',
  members: 'Direktori Anggota',
};

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserSession | null>(null);
  const [state, setState] = useState<BootstrapState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('catalog');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<'member-login' | 'member-register' | 'admin'>('member-login');

  const [wsConnected, setWsConnected] = useState(false);
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const [memberRefreshTick, setMemberRefreshTick] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  const fetchBootstrap = useCallback(async (authToken: string | null) => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      const res = await fetch('/api/bootstrap', { headers });
      if (res.ok) {
        const data = (await res.json()) as BootstrapState;
        setState(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap(token);
  }, [fetchBootstrap, token]);

  // WebSocket real-time synchronization with exponential backoff
  useEffect(() => {
    let closedByUnmount = false;
    let retryMs = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (closedByUnmount) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        retryMs = 1000;
        setWsConnected(true);
        if (tokenRef.current) {
          ws.send(JSON.stringify({ type: 'auth', token: tokenRef.current }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            type?: string;
            eventName?: string;
            latestActivity?: { summary: string; actorName: string } | null;
            onlineConnections?: number;
            state?: BootstrapState;
          };
          if (msg.type === 'presence' && typeof msg.onlineConnections === 'number') {
            setState((prev) => (prev ? { ...prev, onlineConnections: msg.onlineConnections! } : prev));
          }
          if (msg.type === 'sync' && msg.state) {
            setState(msg.state);
            setMemberRefreshTick((n) => n + 1);
            if (msg.latestActivity && msg.eventName !== 'auth:synced') {
              setLiveNotice(`${msg.latestActivity.actorName}: ${msg.latestActivity.summary}`);
            }
          }
        } catch {
          // Ignore invalid socket frame
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!closedByUnmount) {
          retryTimer = setTimeout(() => {
            retryMs = Math.min(12000, retryMs * 2);
            connect();
          }, retryMs);
        }
      };
    }

    connect();

    return () => {
      closedByUnmount = true;
      if (retryTimer) clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, []);

  // Re-authenticate active WebSocket when session token changes
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'auth', token }));
    }
  }, [token]);

  useEffect(() => {
    if (!liveNotice) return;
    const timer = setTimeout(() => setLiveNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [liveNotice]);

  function openAuth(tab: 'member-login' | 'member-register' | 'admin' = 'member-login') {
    setAuthInitialTab(tab);
    setAuthModalOpen(true);
  }

  function handleAuthenticated(nextToken: string, nextUser: UserSession) {
    setToken(nextToken);
    setUser(nextUser);
    setActiveTab(nextUser.role === 'admin' ? 'admin-dashboard' : 'member-dashboard');
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
    if (
      activeTab === 'admin-dashboard' ||
      activeTab === 'member-dashboard' ||
      activeTab === 'collections' ||
      activeTab === 'reports' ||
      activeTab === 'members'
    ) {
      setActiveTab('catalog');
    }
  }

  async function apiMutate(url: string, method: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
    if (!token) {
      openAuth('member-login');
      return { ok: false, error: 'Silakan masuk terlebih dahulu.' };
    }
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data.error || 'Operasi gagal diproses.' };
      }
      await fetchBootstrap(token);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Koneksi ke server terputus.' };
    }
  }

  const navItems: Array<{ id: NavTab; label: string; icon: typeof BookOpen; visible: boolean }> = [
    { id: 'catalog', label: 'Katalog Koleksi', icon: BookOpen, visible: true },
    { id: 'analytics', label: 'Statistik & Tren', icon: BarChart3, visible: true },
    {
      id: 'member-dashboard',
      label: 'Dashboard Member',
      icon: UserCheck,
      visible: user?.role === 'member',
    },
    {
      id: 'admin-dashboard',
      label: 'Dashboard Admin',
      icon: LayoutDashboard,
      visible: user?.role === 'admin',
    },
    {
      id: 'collections',
      label: 'Manajemen Koleksi',
      icon: BookCopy,
      visible: user?.role === 'admin',
    },
    {
      id: 'reports',
      label: 'Pelaporan Otomatis',
      icon: FileSpreadsheet,
      visible: user?.role === 'admin',
    },
    {
      id: 'members',
      label: 'Direktori Anggota',
      icon: Users,
      visible: user?.role === 'admin',
    },
  ];

  const visibleNav = navItems.filter((item) => item.visible);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('catalog');
              setMobileNavOpen(false);
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Aksara Pustaka
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Tutup menu navigasi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navigasi utama">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileNavOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-teal-50 text-[#0F766E]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}

          {!user && (
            <div className="mt-6 border-t border-slate-200 pt-4 px-2 space-y-2">
              <p className="text-xs font-medium text-slate-500">Akses Dashboard</p>
              <button
                type="button"
                onClick={() => openAuth('member-login')}
                className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <UserCheck className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                Portal Member
              </button>
              <button
                type="button"
                onClick={() => openAuth('admin')}
                className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
                {state?.adminConfigured ? 'Portal Admin' : 'Aktivasi Admin'}
              </button>
            </div>
          )}
        </nav>

        <div className="border-t border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Wifi
                className={`h-3.5 w-3.5 ${wsConnected ? 'text-emerald-700' : 'text-amber-600'}`}
                aria-hidden="true"
              />
              {wsConnected ? 'Live Sinkron' : 'Menyambungkan'}
            </span>
            <span className="font-mono tabular-nums">{state?.onlineConnections ?? 1} sesi</span>
          </div>

          {user ? (
            <div className="border-t border-slate-100 pt-3">
              <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">
                {user.role === 'admin' ? 'Admin Pustakawan' : 'Anggota'} ·{' '}
                <span className="font-mono">{user.memberCode}</span>
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Keluar Sesi
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuth('member-login')}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0F766E] px-3 py-2 text-xs font-semibold text-white hover:bg-[#115E59]"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              Masuk / Daftar
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header Contract */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 backdrop-blur-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden text-slate-400 sm:inline">Aksara Pustaka</span>
              <span className="hidden text-slate-300 sm:inline" aria-hidden="true">/</span>
              <h1 className="font-display text-base font-semibold text-slate-900 truncate">
                {TAB_LABELS[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {user?.role === 'admin' ? (
              <button
                type="button"
                onClick={() => setActiveTab('collections')}
                className="rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0 hover:bg-[#115E59]"
              >
                Kelola Koleksi
              </button>
            ) : user?.role === 'member' ? (
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'member-dashboard' ? 'catalog' : 'member-dashboard')}
                className="rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0 hover:bg-[#115E59]"
              >
                {activeTab === 'member-dashboard' ? 'Jelajahi Katalog' : 'Pinjaman Saya'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuth('member-register')}
                className="rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0 hover:bg-[#115E59]"
              >
                Daftar Anggota
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1360px] flex-1 space-y-6 p-6">
          {/* Live Broadcast Notification */}
          {liveNotice && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50/80 px-4 py-2.5 text-xs text-teal-900"
            >
              <span>
                <strong>Pembaruan Real-Time:</strong> {liveNotice}
              </span>
              <button
                type="button"
                onClick={() => setLiveNotice(null)}
                className="font-medium underline hover:no-underline"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Global KPI Strip */}
          {loading || !state ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="h-24 rounded-xl border border-slate-200 bg-white p-5" />
              ))}
            </div>
          ) : (
            <section
              aria-label="Ringkasan metrik perpustakaan"
              className="grid grid-cols-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-y-0 sm:divide-x"
            >
              <div className="p-5">
                <p className="text-xs text-slate-500">Koleksi Terdaftar</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  {state.stats.totalTitles}
                  <span className="ml-1.5 text-xs font-normal text-slate-500">
                    judul ({state.stats.totalCopies} eks)
                  </span>
                </p>
              </div>
              <div className="p-5">
                <p className="text-xs text-slate-500">Eksemplar Tersedia</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
                  {state.stats.availableCopies}
                  <span className="ml-1.5 text-xs font-normal text-slate-500">siap pinjam</span>
                </p>
              </div>
              <div className="p-5">
                <p className="text-xs text-slate-500">Sirkulasi Berjalan</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  {state.stats.activeLoans + state.stats.overdueLoans}
                  {state.stats.overdueLoans > 0 && (
                    <span className="ml-2 text-xs font-medium text-red-700">
                      ({state.stats.overdueLoans} terlambat)
                    </span>
                  )}
                </p>
              </div>
              <div className="p-5">
                <p className="text-xs text-slate-500">Anggota & Utilisasi</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  {state.stats.totalMembers}
                  <span className="ml-1.5 text-xs font-normal text-slate-500">
                    anggota · {state.stats.utilizationRate}% terpakai
                  </span>
                </p>
              </div>
            </section>
          )}

          {/* Active Route Viewport */}
          {!loading && state && (
            <>
              {activeTab === 'catalog' && (
                <CatalogView
                  books={state.books}
                  user={user}
                  activeUserLoans={state.loans}
                  onBorrowBook={(bookId, durationDays) =>
                    apiMutate('/api/loans', 'POST', { bookId, durationDays })
                  }
                  onOpenAuth={openAuth}
                />
              )}

              {activeTab === 'analytics' && (
                <AnalyticsView
                  stats={state.stats}
                  activities={state.activities}
                  onlineConnections={state.onlineConnections}
                  wsConnected={wsConnected}
                />
              )}

              {activeTab === 'member-dashboard' && user?.role === 'member' && (
                <MemberDashboard
                  user={user}
                  loans={state.loans}
                  onReturnLoan={(loanId) => apiMutate(`/api/loans/${loanId}/return`, 'POST')}
                  onExtendLoan={(loanId) => apiMutate(`/api/loans/${loanId}/extend`, 'POST')}
                  onGoToCatalog={() => setActiveTab('catalog')}
                />
              )}

              {activeTab === 'admin-dashboard' && user?.role === 'admin' && (
                <AdminDashboard
                  books={state.books}
                  loans={state.loans}
                  activities={state.activities}
                  stats={state.stats}
                  onlineConnections={state.onlineConnections}
                  wsConnected={wsConnected}
                  onReturnLoan={(loanId) => apiMutate(`/api/loans/${loanId}/return`, 'POST')}
                  onExtendLoan={(loanId) => apiMutate(`/api/loans/${loanId}/extend`, 'POST')}
                  onCreateLoan={(bookId, durationDays, memberEmail) =>
                    apiMutate('/api/loans', 'POST', { bookId, durationDays, memberEmail })
                  }
                />
              )}

              {activeTab === 'collections' && user?.role === 'admin' && (
                <CollectionManager
                  books={state.books}
                  onCreateBook={(payload) => apiMutate('/api/books', 'POST', payload)}
                  onUpdateBook={(id, payload: Partial<Book>) =>
                    apiMutate(`/api/books/${id}`, 'PATCH', payload)
                  }
                  onDeleteBook={(id) => apiMutate(`/api/books/${id}`, 'DELETE')}
                />
              )}

              {activeTab === 'reports' && user?.role === 'admin' && token && (
                <AutomatedReportsView
                  token={token}
                  reports={state.reports}
                  onGenerateReport={(scheduleType: AutomatedReport['scheduleType']) =>
                    apiMutate('/api/reports/generate', 'POST', { scheduleType })
                  }
                />
              )}

              {activeTab === 'members' && user?.role === 'admin' && token && (
                <MembersDirectory token={token} refreshTrigger={memberRefreshTick} />
              )}
            </>
          )}
        </main>
      </div>

      <AuthModal
        open={authModalOpen}
        initialTab={authInitialTab}
        adminConfigured={state?.adminConfigured ?? false}
        adminPasscodeManagedByEnv={state?.adminPasscodeManagedByEnv ?? false}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  );
}
