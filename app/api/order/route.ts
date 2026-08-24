import { NextRequest, NextResponse } from 'next/server';
import { list, put, del } from '@vercel/blob';

export const dynamic = 'force-dynamic';

const PREFIX = '__order';

async function fetchOrder(): Promise<string[] | null> {
  try {
    const { blobs } = await list({ prefix: PREFIX });
    if (!blobs.length) return null;
    blobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    const res = await fetch(blobs[0].url, { cache: 'no-store', next: { revalidate: 0 } });
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const order = await fetchOrder();
  return NextResponse.json(order, { headers: { 'Cache-Control': 'no-store, no-cache' } });
}

export async function POST(request: NextRequest) {
  const order = await request.json() as string[];
  const { blobs } = await list({ prefix: PREFIX });
  await Promise.all(blobs.map((b) => del(b.url)));
  await put(`${PREFIX}.json`, JSON.stringify(order), {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'application/json',
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const { blobs } = await list({ prefix: PREFIX });
  await Promise.all(blobs.map((b) => del(b.url)));
  return NextResponse.json({ ok: true });
}
