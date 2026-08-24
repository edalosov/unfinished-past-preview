import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { slugToTitle } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export interface Artwork {
  id: string;
  title: string;
  url: string;
  uploadedAt: string;
  reservedBy: string | null;
}

async function getOrder(): Promise<string[] | null> {
  try {
    const { blobs } = await list({ prefix: '__order' });
    if (!blobs.length) return null;
    blobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    const res = await fetch(blobs[0].url, { cache: 'no-store', next: { revalidate: 0 } });
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

async function getReservations(): Promise<Record<string, string>> {
  try {
    const { blobs } = await list({ prefix: '__reservations' });
    if (!blobs.length) return {};
    blobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    const res = await fetch(blobs[0].url, { cache: 'no-store', next: { revalidate: 0 } });
    const data = await res.json() as Record<string, { reservedBy: string }>;
    const flat: Record<string, string> = {};
    for (const [url, val] of Object.entries(data)) flat[url] = val.reservedBy;
    return flat;
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    const [{ blobs }, reservations, order] = await Promise.all([list(), getReservations(), getOrder()]);

    const artworks: Artwork[] = blobs
      .filter((blob) => !blob.pathname.startsWith('__'))
      .map((blob) => {
        const nameWithoutExt = blob.pathname.replace(/\.[^.]+$/, '');
        const separatorIndex = nameWithoutExt.indexOf('__');
        const slug =
          separatorIndex !== -1 ? nameWithoutExt.slice(separatorIndex + 2) : nameWithoutExt;
        const title = slug ? slugToTitle(slug) : 'Untitled';

        return {
          id: blob.url,
          title,
          url: blob.url,
          uploadedAt: blob.uploadedAt.toISOString(),
          reservedBy: reservations[blob.url] ?? null,
        };
      });

    if (order && order.length > 0) {
      const orderMap = new Map(order.map((url, i) => [url, i]));
      artworks.sort((a, b) => {
        const ai = orderMap.has(a.url) ? orderMap.get(a.url)! : Infinity;
        const bi = orderMap.has(b.url) ? orderMap.get(b.url)! : Infinity;
        return ai - bi;
      });
    } else {
      artworks.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    }

    return NextResponse.json(artworks, {
      headers: { 'Cache-Control': 'no-store, no-cache' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load artworks' }, { status: 500 });
  }
}
