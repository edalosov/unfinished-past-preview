'use client';

import { useEffect } from 'react';

interface Props {
  artwork: { id: string; url: string; title: string } | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRandom: () => void;
  onBack: () => void;
  canGoBack: boolean;
  onForward: () => void;
  canGoForward: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
}

export default function FullscreenModal({
  artwork,
  onClose,
  onPrev,
  onNext,
  onRandom,
  onBack,
  canGoBack,
  onForward,
  canGoForward,
  isSaved,
  onToggleSave,
}: Props) {
  const isOpen = artwork !== null;

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [isOpen, onClose, onPrev, onNext]);

  if (!artwork) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-2"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-6 text-zinc-500 hover:text-white transition-colors text-2xl leading-none"
        aria-label="Close"
      >
        ×
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        className="absolute left-1 sm:left-6 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors text-4xl leading-none px-3 py-6"
        aria-label="Previous artwork"
      >
        ‹
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        className="absolute right-1 sm:right-6 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors text-4xl leading-none px-3 py-6"
        aria-label="Next artwork"
      >
        ›
      </button>

      <div
        className="flex items-center gap-2 mb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onBack}
          disabled={!canGoBack}
          className={`text-[10px] tracking-[0.2em] uppercase px-4 py-1.5 border transition-colors ${
            canGoBack
              ? 'border-zinc-600 text-[#E4DFDA] hover:border-white hover:text-white'
              : 'border-zinc-800 text-zinc-700 cursor-not-allowed'
          }`}
          aria-label="Back to previous image"
        >
          ← Back
        </button>
        <button
          onClick={onForward}
          disabled={!canGoForward}
          className={`text-[10px] tracking-[0.2em] uppercase px-4 py-1.5 border transition-colors ${
            canGoForward
              ? 'border-zinc-600 text-[#E4DFDA] hover:border-white hover:text-white'
              : 'border-zinc-800 text-zinc-700 cursor-not-allowed'
          }`}
          aria-label="Forward to next image"
        >
          Next →
        </button>
        <button
          onClick={onRandom}
          className="text-[10px] tracking-[0.2em] uppercase px-4 py-1.5 border border-zinc-600 text-[#E4DFDA] hover:border-white hover:text-white transition-colors"
          aria-label="Random artwork"
        >
          Random
        </button>
        <button
          onClick={onToggleSave}
          className={`text-[10px] tracking-[0.2em] uppercase px-4 py-1.5 border transition-colors ${
            isSaved
              ? 'border-red-500 text-red-400 hover:border-red-300 hover:text-red-300'
              : 'border-zinc-600 text-[#E4DFDA] hover:border-white hover:text-white'
          }`}
          aria-label={isSaved ? 'Remove from saved' : 'Save'}
        >
          {isSaved ? '♥ Saved' : '♡ Save'}
        </button>
      </div>

      <div
        className="relative flex items-center justify-center w-full max-w-6xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={artwork.url}
          alt={artwork.title}
          className="max-w-full max-h-[85vh] object-contain"
        />
      </div>

      <p className="mt-6 text-white text-xs tracking-[0.35em] uppercase">
        {artwork.title}
      </p>
    </div>
  );
}
