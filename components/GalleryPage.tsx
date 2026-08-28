'use client';

import { useState, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
import ArtworkCard from './ArtworkCard';
import FullscreenModal from './FullscreenModal';
import { useSavedArtworks } from '@/lib/useSavedArtworks';

interface Artwork {
  id: string;
  title: string;
  thumbnailUrl: string;
  url: string;
  reservedBy: string | null;
}

const btnClass =
  'border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-[10px] tracking-[0.2em] uppercase px-3 py-1.5 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-500 dark:hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-all';

export default function GalleryPage() {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [future, setFuture] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [overlayMounted, setOverlayMounted] = useState(true);
  const [showSaved, setShowSaved] = useState(false);
  const { savedIds, toggle: toggleSave } = useSavedArtworks();

  useEffect(() => {
    fetch('/api/artworks')
      .then((r) => r.json())
      .then((data: unknown) => {
        const list: Artwork[] = Array.isArray(data) ? data : [];
        setArtworks(list);
        setLoading(false);

        if (list.length === 0) {
          setReady(true);
          return;
        }

        // Preload the first batch of non-GIF images so the grid appears polished
        const toPreload = list
          .filter((a) => !a.url.split('?')[0].toLowerCase().endsWith('.gif'))
          .slice(0, 10);

        const preloads = toPreload.map(
          (a) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = img.onerror = () => resolve();
              img.src = a.url;
            })
        );

        const minWait = new Promise<void>((resolve) => setTimeout(resolve, 2000));
        const maxWait = new Promise<void>((resolve) => setTimeout(resolve, 5000));
        Promise.all([Promise.race([Promise.all(preloads), maxWait]), minWait]).then(() => setReady(true));
      })
      .catch(() => {
        setLoading(false);
        setReady(true);
      });

  }, []);

  const sorted = artworks.filter((a) => !showSaved || savedIds.has(a.id));

  function openAt(index: number) {
    setHistory([]);
    setFuture([]);
    setSelectedIndex(index);
  }

  function showRandom() {
    if (sorted.length === 0) return;
    if (selectedIndex === null) setHistory([]);
    else setHistory((h) => [...h, selectedIndex]);
    setFuture([]);
    setSelectedIndex(Math.floor(Math.random() * sorted.length));
  }

  function showNext() {
    if (selectedIndex === null) return;
    setHistory((h) => [...h, selectedIndex]);
    setFuture([]);
    setSelectedIndex((selectedIndex + 1) % sorted.length);
  }

  function showPrev() {
    if (selectedIndex === null) return;
    setHistory((h) => [...h, selectedIndex]);
    setFuture([]);
    setSelectedIndex((selectedIndex - 1 + sorted.length) % sorted.length);
  }

  function showBack() {
    if (history.length === 0 || selectedIndex === null) return;
    setFuture((f) => [...f, selectedIndex]);
    setSelectedIndex(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  }

  function showForward() {
    if (future.length === 0 || selectedIndex === null) return;
    setHistory((h) => [...h, selectedIndex]);
    setSelectedIndex(future[future.length - 1]);
    setFuture(future.slice(0, -1));
  }

  function closeModal() {
    setSelectedIndex(null);
    setHistory([]);
    setFuture([]);
  }

  return (
    <>
      {/* Loading overlay — sits on top while assets warm up, then fades out */}
      {overlayMounted && (
        <div
          onTransitionEnd={() => { if (ready) setOverlayMounted(false); }}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FFFFFC] dark:bg-[#0a0a0a] transition-opacity duration-700 ${
            ready ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <style>{`
            @keyframes loadbar { from { transform: scaleX(0); } to { transform: scaleX(0.88); } }
          `}</style>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 tracking-wide">
            Unfinished Past
          </p>
          <p className="mt-3 text-[10px] text-zinc-400 dark:text-zinc-600 tracking-[0.35em] uppercase">
            Loading artworks…
          </p>
          <div className="mt-6 w-48 h-px bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-zinc-400 dark:bg-zinc-500 origin-left"
              style={{ animation: 'loadbar 5s ease-out forwards' }}
            />
          </div>
        </div>
      )}

      <header className="px-6 pt-10 pb-8 flex items-center justify-between">
        <ThemeToggle />

        <h1 className="text-3xl text-zinc-800 dark:text-zinc-200 italic" style={{ fontFamily: 'var(--font-playfair), serif' }}>
          Unfinished Past
        </h1>

        <div className="flex items-center gap-2">
          <button onClick={showRandom} className={btnClass}>
            Random
          </button>
          <button
            onClick={() => { setShowSaved((s) => !s); setSelectedIndex(null); setHistory([]); setFuture([]); }}
            className={showSaved
              ? 'border border-red-500 bg-red-500 text-white text-[10px] tracking-[0.2em] uppercase px-3 py-1.5 font-medium transition-all hover:bg-red-600 hover:border-red-600'
              : btnClass}
          >
            {showSaved ? `♥ Saved${savedIds.size > 0 ? ` (${savedIds.size})` : ''}` : `♡ Saved${savedIds.size > 0 ? ` (${savedIds.size})` : ''}`}
          </button>
        </div>
      </header>

      {loading ? null : artworks.length === 0 ? (
        <div className="flex items-center justify-center py-32">
          <span className="text-zinc-400 dark:text-zinc-700 text-xs tracking-[0.3em] uppercase">
            No works on display
          </span>
        </div>
      ) : showSaved && sorted.length === 0 ? (
        <div className="flex items-center justify-center py-32">
          <span className="text-zinc-400 dark:text-zinc-700 text-xs tracking-[0.3em] uppercase">
            No saved works yet — click ♡ on any artwork
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[2px]">
          {sorted.map((artwork, index) => (
            <ArtworkCard
              key={artwork.id}
              artwork={artwork}
              onClick={() => openAt(index)}
              isSaved={savedIds.has(artwork.id)}
              onToggleSave={() => toggleSave(artwork.id)}
              isReserved={!!artwork.reservedBy}
            />
          ))}
        </div>
      )}

      <FullscreenModal
        artwork={selectedIndex !== null ? sorted[selectedIndex] : null}
        onClose={closeModal}
        onPrev={showPrev}
        onNext={showNext}
        onRandom={showRandom}
        onBack={showBack}
        canGoBack={history.length > 0}
        onForward={showForward}
        canGoForward={future.length > 0}
        isSaved={selectedIndex !== null ? savedIds.has(sorted[selectedIndex]?.id) : false}
        onToggleSave={() => { if (selectedIndex !== null) toggleSave(sorted[selectedIndex].id); }}

      />
    </>
  );
}
