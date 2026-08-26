'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { upload } from '@vercel/blob/client';
import { titleToSlug } from '@/lib/utils';

interface Artwork {
  id: string;
  title: string;
  originalTitle: string;
  thumbnailUrl: string;
  url: string;
}

interface StorageInfo {
  totalMB: number;
  limitMB: number;
  count: number;
}

interface PendingItem {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMsg?: string;
}

async function createThumbnail(file: Blob): Promise<Blob | null> {
  if (file.type === 'image/gif') return null;
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
    img.src = objectUrl;
  });
}

function filenameToTitle(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function StaticGif({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [captured, setCaptured] = useState(false);

  function capture() {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!img || !canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cw = container.clientWidth || 300;
    const ch = container.clientHeight || 169;
    canvas.width = cw;
    canvas.height = ch;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return;
    const scale = Math.max(cw / iw, ch / ih);
    const sw = cw / scale, sh = ch / scale;
    try {
      ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, cw, ch);
      setCaptured(true);
      img.src = '';
    } catch {}
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        crossOrigin="anonymous"
        loading="lazy"
        onLoad={capture}
        className={`w-full h-full object-cover ${captured ? 'hidden' : ''}`}
      />
      <canvas ref={canvasRef} className={`w-full h-full ${captured ? '' : 'hidden'}`} />
    </div>
  );
}

const inputClass =
  'w-full bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-600 px-3 py-2 text-xs outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors disabled:opacity-50';

export default function AdminPanel() {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState(false);
  const [thumbProgress, setThumbProgress] = useState({ done: 0, total: 0 });
  const [isDeleting, setIsDeleting] = useState(false);
  const [reservations, setReservations] = useState<Record<string, string>>({});
  const [reserveEditing, setReserveEditing] = useState<string | null>(null);
  const [reserveDraft, setReserveDraft] = useState('');
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const [savedOrder, setSavedOrder] = useState<string[] | null>(null);
  const [orderLoaded, setOrderLoaded] = useState(false);
  const [hasUnsavedOrder, setHasUnsavedOrder] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);

  async function loadOrder() {
    try {
      const res = await fetch('/api/order');
      if (res.ok) {
        const data = await res.json();
        setSavedOrder(Array.isArray(data) ? data : null);
      }
    } catch {}
    setOrderLoaded(true);
  }

  async function loadReservations() {
    try {
      const res = await fetch('/api/reservations');
      if (res.ok) {
        const data = await res.json();
        const flat: Record<string, string> = {};
        for (const [url, val] of Object.entries(data as Record<string, { reservedBy: string }>)) {
          flat[url] = val.reservedBy;
        }
        setReservations(flat);
      }
    } catch {}
  }

  async function saveReservation(url: string, reservedBy: string | null) {
    await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, reservedBy }),
    });
    await loadReservations();
  }

  async function loadArtworks() {
    try {
      const res = await fetch(`/api/artworks?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) setArtworks(data);
    } finally {
      setLoading(false);
    }
  }

  async function loadStorage() {
    try {
      const res = await fetch('/api/storage');
      if (res.ok) setStorage(await res.json());
    } catch {}
  }

  useEffect(() => {
    loadArtworks();
    loadStorage();
    loadReservations();
    loadOrder();
  }, []);

  // Sync localOrder whenever artworks or savedOrder change
  useEffect(() => {
    if (!orderLoaded) return;
    if (artworks.length === 0) { setLocalOrder([]); return; }
    if (savedOrder && savedOrder.length > 0) {
      const present = savedOrder.filter((url) => artworks.some((a) => a.url === url));
      const newOnes = artworks.filter((a) => !savedOrder.includes(a.url)).map((a) => a.url);
      setLocalOrder([...present, ...newOnes]);
    } else {
      setLocalOrder(artworks.map((a) => a.url));
    }
    setHasUnsavedOrder(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artworks, savedOrder, orderLoaded]);

  function addFiles(files: FileList) {
    const newItems: PendingItem[] = Array.from(files).map((file, i) => ({
      id: `${Date.now()}-${i}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      title: filenameToTitle(file.name),
      status: 'pending' as const,
    }));
    setPendingItems((prev) => [...prev, ...newItems]);
  }

  function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = '';
  }

  function updateTitle(id: string, title: string) {
    setPendingItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title } : item))
    );
  }

  function removePending(id: string) {
    setPendingItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  function clearAll() {
    pendingItems.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setPendingItems([]);
  }

  async function uploadAll() {
    const toUpload = pendingItems.filter((i) => i.status === 'pending');
    if (!toUpload.length) return;

    setIsUploading(true);
    setUploadedCount(0);
    let count = 0;

    for (const item of toUpload) {
      setPendingItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'uploading' } : i))
      );

      try {
        const ext = item.file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const slug = titleToSlug(item.title.trim() || 'untitled') || 'untitled';
        const ts = Date.now();
        const filename = `${ts}__${slug}.${ext}`;

        // Generate and upload compressed thumbnail (non-GIF only)
        const thumbBlob = await createThumbnail(item.file);
        if (thumbBlob) {
          await upload(`thumb__${ts}__${slug}.jpg`, thumbBlob, {
            access: 'public',
            handleUploadUrl: '/api/upload',
          });
        }

        await upload(filename, item.file, {
          access: 'public',
          handleUploadUrl: '/api/upload',
        });

        setPendingItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'done' } : i))
        );
        count++;
        setUploadedCount(count);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setPendingItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'error', errorMsg: msg } : i))
        );
      }
    }

    setIsUploading(false);
    await loadArtworks();
    await loadStorage();

    // Auto-clear successfully uploaded items after a short delay
    setTimeout(() => {
      setPendingItems((prev) => {
        prev.filter((i) => i.status === 'done').forEach((i) => URL.revokeObjectURL(i.previewUrl));
        return prev.filter((i) => i.status !== 'done');
      });
    }, 1200);
  }

  async function handleDelete(artwork: Artwork) {
    if (!confirm(`Remove "${artwork.title}" from the gallery?`)) return;

    const res = await fetch('/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: artwork.url, thumbnailUrl: artwork.thumbnailUrl }),
    });

    if (res.ok) {
      setArtworks((prev) => prev.filter((a) => a.id !== artwork.id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(artwork.id); return next; });
      await loadStorage();
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() { setSelectedIds(new Set(artworks.map((a) => a.id))); }
  function clearSelection() { setSelectedIds(new Set()); }

  async function handleDeleteSelected() {
    const toDelete = artworks.filter((a) => selectedIds.has(a.id));
    if (!toDelete.length) return;
    if (!confirm(`Remove ${toDelete.length} artwork${toDelete.length === 1 ? '' : 's'} from the gallery?`)) return;
    setIsDeleting(true);
    for (const artwork of toDelete) {
      await fetch('/api/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: artwork.url, thumbnailUrl: artwork.thumbnailUrl }),
      });
    }
    setIsDeleting(false);
    setSelectedIds(new Set());
    await loadArtworks();
    await loadStorage();
  }

  async function handleDeleteAll() {
    if (!artworks.length) return;
    if (!confirm(`Remove ALL ${artworks.length} artworks from the gallery? This cannot be undone.`)) return;
    setIsDeleting(true);
    for (const artwork of artworks) {
      await fetch('/api/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: artwork.url, thumbnailUrl: artwork.thumbnailUrl }),
      });
    }
    setIsDeleting(false);
    setSelectedIds(new Set());
    await loadArtworks();
    await loadStorage();
  }

  function onDragStart(idx: number) {
    setDragIdx(idx);
    dragOverIdx.current = idx;
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx === null || dragOverIdx.current === idx) return;
    dragOverIdx.current = idx;
    setLocalOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(dragIdx, 1);
      next.splice(idx, 0, item);
      return next;
    });
    setDragIdx(idx);
    setHasUnsavedOrder(true);
  }

  function onDragEnd() {
    setDragIdx(null);
    dragOverIdx.current = null;
  }

  async function saveOrder() {
    setIsSavingOrder(true);
    await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localOrder),
    });
    setSavedOrder([...localOrder]);
    setHasUnsavedOrder(false);
    setIsSavingOrder(false);
  }

  async function resetOrder() {
    await fetch('/api/order', { method: 'DELETE' });
    setSavedOrder(null);
    setLocalOrder(artworks.map((a) => a.url));
    setHasUnsavedOrder(false);
  }

  async function generateThumbnails() {
    const missing = artworks.filter(
      (a) => (!a.thumbnailUrl || a.thumbnailUrl === a.url) && !a.url.split('?')[0].toLowerCase().endsWith('.gif')
    );
    if (!missing.length) return;
    setIsGeneratingThumbs(true);
    setThumbProgress({ done: 0, total: missing.length });

    for (let i = 0; i < missing.length; i++) {
      const artwork = missing[i];
      try {
        const res = await fetch(artwork.url, { mode: 'cors' });
        const blob = await res.blob();
        const thumbBlob = await createThumbnail(blob);
        if (thumbBlob) {
          const pathname = new URL(artwork.url).pathname.replace(/^\//, '');
          const base = pathname.replace(/\.[^.]+$/, '');
          await upload(`thumb__${base}.jpg`, thumbBlob, {
            access: 'public',
            handleUploadUrl: '/api/upload',
          });
        }
      } catch {}
      setThumbProgress({ done: i + 1, total: missing.length });
    }

    setIsGeneratingThumbs(false);
    await loadArtworks();
  }

  const pendingCount = pendingItems.filter((i) => i.status === 'pending').length;
  const totalQueued = pendingItems.filter((i) => i.status !== 'error').length;

  const usedMB = storage?.totalMB ?? 0;
  const limitMB = storage?.limitMB ?? 500;
  const pct = Math.min((usedMB / limitMB) * 100, 100);
  const barColor =
    pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-14">
      {/* Storage bar */}
      <section className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs tracking-[0.3em] uppercase text-zinc-500">Storage</span>
          {storage ? (
            <span className="text-xs text-zinc-500">
              {usedMB.toFixed(1)} MB{' '}
              <span className="text-zinc-400 dark:text-zinc-600">/ {limitMB} MB</span>
            </span>
          ) : (
            <span className="text-xs text-zinc-400 dark:text-zinc-600">Loading…</span>
          )}
        </div>

        <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ${storage ? barColor : 'bg-zinc-300 dark:bg-zinc-700'}`}
            style={{ width: storage ? `${pct}%` : '0%' }}
          />
        </div>

        <p className="text-[11px] text-zinc-400 dark:text-zinc-600">
          {storage
            ? `${(limitMB - usedMB).toFixed(1)} MB remaining · ${storage.count} ${storage.count === 1 ? 'file' : 'files'}`
            : ''}
        </p>
      </section>

      {/* Upload section */}
      <section className="space-y-6">
        <h2 className="text-xs tracking-[0.3em] uppercase text-zinc-500">Add Artworks</h2>

        {pendingItems.length === 0 ? (
          <label className="inline-flex items-center gap-2 cursor-pointer border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs tracking-widest uppercase px-6 py-3 hover:border-zinc-600 dark:hover:border-zinc-500 transition-colors">
            + Add Images
            <input type="file" accept="image/*" multiple onChange={handleFilesSelected} className="hidden" />
          </label>
        ) : (
          <div className="space-y-6">
            {/* Preview grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {pendingItems.map((item) => (
                <div key={item.id} className="space-y-2">
                  <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                    <img
                      src={item.previewUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />

                    {item.status === 'uploading' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white text-xs tracking-widest uppercase">Uploading…</span>
                      </div>
                    )}
                    {item.status === 'done' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-emerald-400 text-xs tracking-widest">✓</span>
                      </div>
                    )}
                    {item.status === 'error' && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-3">
                        <span className="text-red-400 text-xs text-center leading-relaxed">
                          {item.errorMsg}
                        </span>
                      </div>
                    )}

                    {item.status === 'pending' && !isUploading && (
                      <button
                        onClick={() => removePending(item.id)}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white text-sm flex items-center justify-center hover:bg-black/80 transition-colors"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateTitle(item.id, e.target.value)}
                    disabled={item.status !== 'pending' || isUploading}
                    placeholder="Artwork title"
                    className={inputClass}
                  />
                </div>
              ))}
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-5 flex-wrap">
              <button
                onClick={uploadAll}
                disabled={isUploading || pendingCount === 0}
                className="bg-zinc-900 text-zinc-100 dark:bg-white dark:text-black text-xs tracking-widest uppercase py-3 px-8 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isUploading
                  ? `Uploading ${uploadedCount} of ${totalQueued}…`
                  : `Upload ${pendingCount} image${pendingCount === 1 ? '' : 's'}`}
              </button>

              {!isUploading && (
                <>
                  <label className="cursor-pointer text-xs tracking-widest uppercase text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                    + Add more
                    <input
                      ref={addMoreRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFilesSelected}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={clearAll}
                    className="text-xs tracking-widest uppercase text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    Clear all
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Gallery section */}
      <section className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-xs tracking-[0.3em] uppercase text-zinc-500">
            Gallery{!loading && ` — ${artworks.length} ${artworks.length === 1 ? 'work' : 'works'}`}
          </h2>
          {!loading && artworks.length > 0 && (
            <div className="flex items-center gap-4 text-xs tracking-widest uppercase flex-wrap">
              {selectedIds.size > 0 ? (
                <>
                  <span className="text-zinc-500">{selectedIds.size} selected</span>
                  <button onClick={clearSelection} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                    Deselect All
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={isDeleting}
                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    {isDeleting ? 'Deleting…' : `Delete Selected (${selectedIds.size})`}
                  </button>
                </>
              ) : (
                <>
                  {hasUnsavedOrder && (
                    <button
                      onClick={saveOrder}
                      disabled={isSavingOrder}
                      className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors disabled:opacity-40"
                    >
                      {isSavingOrder ? 'Saving…' : 'Save Order'}
                    </button>
                  )}
                  {savedOrder && (
                    <button onClick={resetOrder} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                      Reset Order
                    </button>
                  )}
                  {(() => {
                    const needsThumb = artworks.filter(
                      (a) => (!a.thumbnailUrl || a.thumbnailUrl === a.url) && !a.url.split('?')[0].toLowerCase().endsWith('.gif')
                    ).length;
                    return (
                      <button
                        onClick={generateThumbnails}
                        disabled={isGeneratingThumbs || needsThumb === 0}
                        className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors disabled:opacity-40"
                      >
                        {isGeneratingThumbs
                          ? `Generating thumbnails ${thumbProgress.done}/${thumbProgress.total}…`
                          : `Generate Thumbnails (${needsThumb})`}
                      </button>
                    );
                  })()}
                  <button onClick={selectAll} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                    Select All
                  </button>
                  <button
                    onClick={handleDeleteAll}
                    disabled={isDeleting}
                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    Delete All
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {!loading && artworks.length > 0 && !hasUnsavedOrder && (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-600 tracking-wide">
            Drag artworks to reorder — click <strong>Save Order</strong> to apply to the gallery.
          </p>
        )}

        {loading ? (
          <p className="text-zinc-400 dark:text-zinc-600 text-xs tracking-widest uppercase">Loading…</p>
        ) : artworks.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-700 text-xs">No artworks yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {localOrder.map((url, idx) => {
              const artwork = artworks.find((a) => a.url === url);
              if (!artwork) return null;
              return (
                <div
                  key={artwork.id}
                  draggable={selectedIds.size === 0}
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDragEnd={onDragEnd}
                  className={`space-y-2 transition-opacity ${dragIdx === idx ? 'opacity-40' : 'opacity-100'} ${selectedIds.size === 0 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <div
                    className="relative aspect-video bg-zinc-100 dark:bg-zinc-900 overflow-hidden group"
                    onClick={() => selectedIds.size > 0 ? toggleSelect(artwork.id) : undefined}
                    style={{ cursor: selectedIds.size > 0 ? 'pointer' : 'inherit' }}
                  >
                    {artwork.url.split('?')[0].toLowerCase().endsWith('.gif') ? (
                      <StaticGif src={artwork.url} alt={artwork.title} />
                    ) : (
                      <img
                        src={artwork.url}
                        alt={artwork.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(artwork.id); }}
                      className={`absolute top-2 left-2 w-5 h-5 border-2 flex items-center justify-center transition-all z-10 ${
                        selectedIds.has(artwork.id)
                          ? 'bg-white border-white opacity-100'
                          : 'bg-black/40 border-zinc-300 opacity-0 group-hover:opacity-100'
                      }`}
                      aria-label={selectedIds.has(artwork.id) ? 'Deselect' : 'Select'}
                    >
                      {selectedIds.has(artwork.id) && (
                        <span className="text-black text-[10px] font-bold leading-none">✓</span>
                      )}
                    </button>
                    {selectedIds.size === 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(artwork); }}
                        className="absolute inset-0 bg-black/70 text-red-400 text-xs tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-500 text-xs truncate">
                    {artwork.title !== artwork.originalTitle
                      ? <><span className="text-zinc-900 dark:text-zinc-100 font-medium">{artwork.title}</span> — {artwork.originalTitle}</>
                      : artwork.title}
                  </p>

                  {/* Reservation controls */}
                  {reserveEditing === artwork.url ? (
                    <div className="space-y-1.5">
                      <input
                        autoFocus
                        type="text"
                        value={reserveDraft}
                        onChange={(e) => setReserveDraft(e.target.value)}
                        placeholder="Reserved by…"
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (reserveDraft.trim()) await saveReservation(artwork.url, reserveDraft.trim());
                            setReserveEditing(null);
                            setReserveDraft('');
                          }}
                          className="text-[10px] tracking-widest uppercase text-zinc-900 dark:text-zinc-100 border border-zinc-400 dark:border-zinc-600 px-3 py-1 hover:border-zinc-700 dark:hover:border-zinc-400 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setReserveEditing(null); setReserveDraft(''); }}
                          className="text-[10px] tracking-widest uppercase text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : reservations[artwork.url] ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 tracking-widest uppercase truncate">
                        Reserved — {reservations[artwork.url]}
                      </span>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => { setReserveEditing(artwork.url); setReserveDraft(reservations[artwork.url]); }}
                          className="text-[10px] tracking-widest uppercase text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => saveReservation(artwork.url, null)}
                          className="text-[10px] tracking-widest uppercase text-red-400 hover:text-red-600 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setReserveEditing(artwork.url); setReserveDraft(''); }}
                      className="text-[10px] tracking-widest uppercase text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                    >
                      + Reserve
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
