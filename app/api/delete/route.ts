import { NextRequest, NextResponse } from 'next/server';
import { del, list } from '@vercel/blob';

export async function DELETE(request: NextRequest) {
  const { url, thumbnailUrl } = await request.json();
  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  const deletes: Promise<void>[] = [del(url)];

  // Delete associated thumbnail if provided; otherwise attempt to find it by prefix
  if (thumbnailUrl && thumbnailUrl !== url) {
    deletes.push(del(thumbnailUrl));
  } else {
    try {
      // Derive thumbnail pathname from the original URL's pathname
      const pathname = new URL(url).pathname.replace(/^\//, '');
      const base = pathname.replace(/\.[^.]+$/, '');
      const { blobs } = await list({ prefix: `thumb__${base}` });
      for (const b of blobs) deletes.push(del(b.url));
    } catch {}
  }

  await Promise.all(deletes);
  return NextResponse.json({ success: true });
}
