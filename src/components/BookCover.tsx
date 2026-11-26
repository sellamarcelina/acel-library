import { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface BookCoverProps {
  title: string;
  author: string;
  category: string;
  coverUrl?: string;
  className?: string;
}

const CATEGORY_PALETTE: Record<string, { bg: string; ink: string; accent: string }> = {
  Arsitektur: { bg: 'bg-[#1E293B]', ink: 'text-[#F8FAFC]', accent: 'border-[#94A3B8]/40' },
  Teknologi: { bg: 'bg-[#0F2942]', ink: 'text-[#F1F5F9]', accent: 'border-[#38BDF8]/30' },
  Botani: { bg: 'bg-[#1B3B2B]', ink: 'text-[#F5F7F2]', accent: 'border-[#86EFAC]/30' },
  Sejarah: { bg: 'bg-[#3B2618]', ink: 'text-[#FAF5F0]', accent: 'border-[#FCD34D]/30' },
  Filsafat: { bg: 'bg-[#27272A]', ink: 'text-[#FAFAFA]', accent: 'border-[#D4D4D8]/30' },
};

export function BookCover({ title, author, category, coverUrl, className = '' }: BookCoverProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const palette = CATEGORY_PALETTE[category] || {
    bg: 'bg-[#1E293B]',
    ink: 'text-[#F8FAFC]',
    accent: 'border-[#CBD5E1]/30',
  };

  if (coverUrl && !imgFailed) {
    return (
      <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
        <img
          src={coverUrl}
          alt={`Sampul buku ${title}`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden p-4 ${palette.bg} ${palette.ink} ${className}`}
      aria-label={`Sampul tipografi ${title}`}
    >
      <div className={`flex items-center justify-between border-b pb-2 ${palette.accent}`}>
        <span className="font-mono text-[10px] tracking-wider opacity-75">{category}</span>
        <BookOpen className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
      </div>
      <div className="my-auto py-3">
        <p className="font-display text-sm font-semibold leading-snug line-clamp-4">{title}</p>
      </div>
      <div className={`border-t pt-2 ${palette.accent}`}>
        <p className="truncate text-[11px] opacity-80">{author}</p>
      </div>
    </div>
  );
}
