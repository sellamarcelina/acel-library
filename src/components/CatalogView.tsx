import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Clock, Search, X, AlertCircle } from 'lucide-react';
import type { Book, LoanRecord, UserSession } from '../types.ts';
import { BookCover } from './BookCover.tsx';

interface CatalogViewProps {
  books: Book[];
  user: UserSession | null;
  activeUserLoans: LoanRecord[];
  onBorrowBook: (bookId: string, durationDays: number) => Promise<{ ok: boolean; error?: string }>;
  onOpenAuth: (tab?: 'member-login' | 'member-register' | 'admin') => void;
}

export function CatalogView({
  books,
  user,
  activeUserLoans,
  onBorrowBook,
  onOpenAuth,
}: CatalogViewProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available'>('all');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [durationDays, setDurationDays] = useState<number>(7);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>(books.map((b) => b.category));
    return ['Semua', ...Array.from(set).sort()];
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((book) => {
      if (selectedCategory !== 'Semua' && book.category !== selectedCategory) return false;
      if (availabilityFilter === 'available' && book.availableCopies <= 0) return false;
      if (!q) return true;
      return (
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.isbn.toLowerCase().includes(q) ||
        book.shelfCode.toLowerCase().includes(q)
      );
    });
  }, [books, query, selectedCategory, availabilityFilter]);

  const activeBorrowedBookIds = useMemo(
    () => new Set(activeUserLoans.filter((l) => l.status !== 'returned').map((l) => l.bookId)),
    [activeUserLoans]
  );

  async function handleConfirmBorrow() {
    if (!selectedBook) return;
    if (!user) {
      setSelectedBook(null);
      onOpenAuth('member-login');
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    const result = await onBorrowBook(selectedBook.id, durationDays);
    setSubmitting(false);

    if (result.ok) {
      setFeedback({
        type: 'success',
        message: `Berhasil meminjam "${selectedBook.title}" selama ${durationDays} hari.`,
      });
      setSelectedBook(null);
    } else {
      setFeedback({
        type: 'error',
        message: result.error || 'Gagal memproses peminjaman.',
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul buku, penulis, ISBN, atau kode rak..."
            aria-label="Cari koleksi buku"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  selectedCategory === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setAvailabilityFilter('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                availabilityFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setAvailabilityFilter('available')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                availabilityFilter === 'available'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tersedia
            </button>
          </div>
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
          <span className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {feedback.message}
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-medium underline hover:no-underline"
          >
            Tutup
          </button>
        </div>
      )}

      {filteredBooks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
          <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
            Tidak ada buku yang cocok
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Ubah kata kunci pencarian atau pilih kategori lain untuk melihat koleksi tersedia.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSelectedCategory('Semua');
              setAvailabilityFilter('all');
            }}
            className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Atur Ulang Filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filteredBooks.map((book) => {
            const isAvailable = book.availableCopies > 0;
            const alreadyBorrowed = activeBorrowedBookIds.has(book.id);

            return (
              <article
                key={book.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white transition-colors hover:border-slate-300"
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBook(book);
                    setFeedback(null);
                  }}
                  className="group block aspect-[3/4] w-full overflow-hidden rounded-t-xl border-b border-slate-100 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                >
                  <BookCover
                    title={book.title}
                    author={book.author}
                    category={book.category}
                    coverUrl={book.coverUrl}
                    className="h-full w-full transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </button>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span>{book.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{book.shelfCode}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{book.year}</span>
                  </div>

                  <h3 className="mt-1.5 font-display text-base font-semibold leading-snug text-slate-900 line-clamp-2">
                    {book.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 truncate">{book.author}</p>

                  <div className="mt-auto pt-4">
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          isAvailable ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {isAvailable ? (
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span className="tabular-nums">
                          {isAvailable ? `${book.availableCopies}/${book.totalCopies} tersedia` : 'Stok habis'}
                        </span>
                      </span>
                      <span className="font-mono text-slate-400 tabular-nums">
                        {book.borrowCount}x dipinjam
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBook(book);
                          setFeedback(null);
                        }}
                        disabled={!isAvailable || alreadyBorrowed}
                        className="flex-1 rounded-lg bg-[#0F766E] px-3 py-2 text-xs font-semibold text-white whitespace-nowrap hover:bg-[#115E59] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        {alreadyBorrowed
                          ? 'Sedang Dipinjam'
                          : isAvailable
                          ? 'Pinjam Buku'
                          : 'Tidak Tersedia'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedBook(book)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 whitespace-nowrap hover:bg-slate-50"
                      >
                        Detail
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-detail-title"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="text-xs text-slate-500">
                <span>{selectedBook.category}</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span className="font-mono">Rak {selectedBook.shelfCode}</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">ISBN {selectedBook.isbn}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBook(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Tutup detail buku"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-[180px_1fr]">
              <div className="aspect-[3/4] w-full max-w-[180px] overflow-hidden rounded-lg border border-slate-200">
                <BookCover
                  title={selectedBook.title}
                  author={selectedBook.author}
                  category={selectedBook.category}
                  coverUrl={selectedBook.coverUrl}
                  className="h-full w-full"
                />
              </div>

              <div className="flex flex-col justify-between space-y-4">
                <div>
                  <h2 id="book-detail-title" className="font-display text-xl font-semibold text-slate-900">
                    {selectedBook.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedBook.author} · {selectedBook.publisher} ({selectedBook.year})
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{selectedBook.synopsis}</p>
                </div>

                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500">
                      Ketersediaan:{' '}
                      <strong className="font-mono text-slate-900 tabular-nums">
                        {selectedBook.availableCopies} dari {selectedBook.totalCopies} eksemplar
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      Denda keterlambatan Rp 2.000/hari
                    </span>
                  </div>

                  {selectedBook.availableCopies > 0 && !activeBorrowedBookIds.has(selectedBook.id) && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-slate-700">Durasi:</span>
                        {[3, 7, 14].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDurationDays(d)}
                            className={`rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${
                              durationDays === d
                                ? 'border-teal-700 bg-teal-50 text-teal-800'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {d} Hari
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleConfirmBorrow}
                        disabled={submitting}
                        className="rounded-lg bg-[#0F766E] px-5 py-2 text-xs font-semibold text-white whitespace-nowrap hover:bg-[#115E59] disabled:opacity-60"
                      >
                        {user
                          ? submitting
                            ? 'Memproses...'
                            : 'Konfirmasi Peminjaman'
                          : 'Masuk untuk Meminjam'}
                      </button>
                    </div>
                  )}

                  {activeBorrowedBookIds.has(selectedBook.id) && (
                    <p className="text-xs font-medium text-teal-800">
                      Anda sedang meminjam buku ini. Kelola pengembalian atau perpanjangan di Dashboard Member.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
