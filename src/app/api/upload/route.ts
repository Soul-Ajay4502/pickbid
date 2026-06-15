import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';

// Anonymous card creation is a supported flow, so this endpoint can't require
// a session — instead it strictly limits what can be uploaded and where.
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

/** Mirror of the client-side sanitizeFolder rule, enforced server-side. */
function sanitizeFolder(raw: string): string {
  return (
    raw
      .split('/')
      .filter(Boolean)
      .slice(0, 3)
      .map((seg) => seg.toLowerCase().replace(/[^a-z0-9_-]+/g, '_'))
      .join('/') || 'uploads'
  );
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const folder = sanitizeFolder((form.get('folder') as string | null) ?? 'uploads');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only image uploads are allowed' }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be under 8MB' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToCloudinary(buffer, folder);

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
