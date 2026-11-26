import { useMemo, useState, type FormEvent } from 'react';
import { Edit3, Plus, Search, Trash2, X } from 'lucide-react';
import type { Book } from '../types.ts';
import { BookCover } from './BookCover.tsx';

interface CollectionManagerProps {
  books: Book[];
  onCreateBook: (payload: Omit<Book, 'id' | 'availableCopies' | 'borrowCount' | 'createdAt' | 'updatedAt'>) => Promise<{ ok: boolean; error?: string }>;
  onUpdateBook: (id: string, payload: Partial<Book>) => Promise<{ ok: boolean; error?: string }>;
  onDeleteBook: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

const COVER_PRESETS = [
  { label: 'Sampul Tipografi Standar', url: '' },
  { label: 'Edisi Arsitektur Tropis', url: '/src/assets/images/book_cover_architecture_1795658108327.jpg' },
  { label: 'Edisi Monograf Algoritma', url: '/src/assets/images/book_cover_algorithms_1795658110765.jpg' },
  { label: 'Edisi Atlas Botani', url: '/src/assets/images/book_cover_botany_1795658109917.jpg' },
  { label: 'Edisi Kartografi Maritim', url: '/src/assets/images/book_cover_maritime_1795658111175.jpg' },
  { label: 'Edisi Filsafat Publik', url: '/src/assets/images/book_cover_philosophy_1795658111627.jpg' },
];

export function CollectionManager({
  books,
  onCreateBook,
  onUpdateBook,
  onDeleteBook,
}: CollectionManagerProps) {
  const [search, setSearch] = useState('');
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [publisher, setPublisher] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [category, setCategory] = useState('Teknologi');
  const [shelfCode, setShelfCode] = useState('T-01');
  const [totalCopies, setTotalCopies] = useState(3);
  const [coverUrl, setCoverUrl] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
    );
  }, [books, search]);

  function openCreate() {
    setEditingBook(null);
    setTitle('');
    setAuthor('');
    setIsbn('');
    setPublisher('');
    setYear(new Date().getFullYear());
    setCategory('Teknologi');
    setShelfCode('T-01');
    setTotalCopies(3);
    setCoverUrl('');
    setSynopsis('');
    setShowCreateModal(true);
  }

  function openEdit(book: Book) {
    setEditingBook(book);
    setTitle(book.title);
    setAuthor(book.author);
    setIsbn(book.isbn);
    setPublisher(book.publisher);
    setYear(book.year);
    setCategory(book.category);
    setShelfCode(book.shelfCode);
    setTotalCopies(book.totalCopies);
    setCoverUrl(book.coverUrl);
    setSynopsis(book.synopsis);
    setShowCreateModal(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const payload = {
      title,
      author,
      isbn,
      publisher,
      year: Number(year),
      category,
      shelfCode,
      totalCopies: Number(totalCopies),
      coverUrl,
      synopsis,
    };

    const res = editingBook
      ? await onUpdateBook(editingBook.id, payload)
      : await onCreateBook(payload);

    setSubmitting(false);
    if (res.ok) {
      setShowCreateModal(false);
      setFeedback({
        type: 'success',
        text: editingBook
          ? `Koleksi "${title}" berhasil diperbarui.`
          : `Koleksi baru "${title}" berhasil ditambahkan ke katalog.`,
      });
    } else {
      setFeedback({ type: 'error', text: res.error || 'Gagal menyimpan data koleksi.' });
    }
  }

  async function handleDelete(book: Book) {
    setFeedback(null);
    const res = await onDeleteBook(book.id);
    if (res.ok) {
      setFeedback({ type: 'success', text: `Koleksi "${book.title}" telah dihapus.` });
    } else {
      setFeedback({ type: 'error', text: res.error || 'Gagal menghapus koleksi.' });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter koleksi menurut judul, penulis, ISBN, kategori..."
            aria-label="Filter inventaris koleksi"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-4 py-2.5 text-xs font-semibold text-white whitespace-nowrap hover:bg-[#115E59]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah Koleksi Baru
        </button>
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

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 pl-6 pr-3">Buku</th>
                <th className="px-3 py-3">ISBN</th>
                <th className="px-3 py-3">Kategori</th>
                <th className="px-3 py-3">Rak</th>
                <th className="px-3 py-3 text-right">Tersedia / Total</th>
                <th className="px-3 py-3 text-right">Total Pinjam</th>
                <th className="py-3 pl-3 pr-6 text-right">Kelola</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBooks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                    Tidak ada koleksi buku yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredBooks.map((book) => (
                  <tr key={book.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pl-6 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-9 shrink-0 overflow-hidden rounded border border-slate-200">
                          <BookCover
                            title={book.title}
                            author={book.author}
                            category={book.category}
                            coverUrl={book.coverUrl}
                            className="h-full w-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate max-w-xs">{book.title}</p>
                          <p className="text-xs text-slate-500 truncate max-w-xs">
                            {book.author} · {book.year}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {book.isbn}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-700 whitespace-nowrap">{book.category}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {book.shelfCode}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-slate-800 tabular-nums whitespace-nowrap">
                      {book.availableCopies} / {book.totalCopies}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {book.borrowCount}x
                    </td>
                    <td className="py-3 pl-3 pr-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(book)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(book)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="collection-modal-title"
        >
          <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 id="collection-modal-title" className="font-display text-base font-semibold text-slate-900">
                {editingBook ? 'Perbarui Data Koleksi Buku' : 'Tambah Koleksi Buku Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Tutup form koleksi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="max-h-[80vh] overflow-y-auto space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="bk-title" className="block text-xs font-medium text-slate-700">
                    Judul Buku
                  </label>
                  <input
                    id="bk-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="bk-author" className="block text-xs font-medium text-slate-700">
                    Penulis
                  </label>
                  <input
                    id="bk-author"
                    type="text"
                    required
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="bk-isbn" className="block text-xs font-medium text-slate-700">
                    ISBN
                  </label>
                  <input
                    id="bk-isbn"
                    type="text"
                    required
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="978-602-..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="bk-publisher" className="block text-xs font-medium text-slate-700">
                    Penerbit
                  </label>
                  <input
                    id="bk-publisher"
                    type="text"
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="bk-category" className="block text-xs font-medium text-slate-700">
                    Kategori
                  </label>
                  <select
                    id="bk-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  >
                    {['Teknologi', 'Arsitektur', 'Botani', 'Sejarah', 'Filsafat', 'Sains', 'Sastra'].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="bk-year" className="block text-xs font-medium text-slate-700">
                    Tahun Terbit
                  </label>
                  <input
                    id="bk-year"
                    type="number"
                    min={1800}
                    max={2100}
                    required
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="bk-shelf" className="block text-xs font-medium text-slate-700">
                      Kode Rak
                    </label>
                    <input
                      id="bk-shelf"
                      type="text"
                      required
                      value={shelfCode}
                      onChange={(e) => setShelfCode(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="bk-copies" className="block text-xs font-medium text-slate-700">
                      Eksemplar
                    </label>
                    <input
                      id="bk-copies"
                      type="number"
                      min={1}
                      max={200}
                      required
                      value={totalCopies}
                      onChange={(e) => setTotalCopies(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="bk-cover" className="block text-xs font-medium text-slate-700">
                    Desain Sampul
                  </label>
                  <select
                    id="bk-cover"
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  >
                    {COVER_PRESETS.map((preset) => (
                      <option key={preset.label} value={preset.url}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="bk-synopsis" className="block text-xs font-medium text-slate-700">
                    Sinopsis Ringkas
                  </label>
                  <textarea
                    id="bk-synopsis"
                    rows={3}
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#0F766E] px-5 py-2 text-xs font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : editingBook ? 'Simpan Perubahan' : 'Tambahkan Koleksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
