import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// POST /api/wishlist/upload-image — compress uploaded image via sharp
export async function POST(request: NextRequest) {
  const { error } = await requireAuth(request);
  if (error) return error;

  try {
    const { imageBase64 } = await request.json();
    if (!imageBase64) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    // Extract raw base64 from data URL
    const matches = imageBase64.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: 'Invalid image data URL' }, { status: 400 });
    }

    const buffer = Buffer.from(matches[2], 'base64');

    // Dynamically import sharp
    const sharp = (await import('sharp')).default;

    // Resize: max width 800px, maintain aspect ratio, JPEG quality 80
    const outputBuffer = await sharp(buffer)
      .resize(800, null, { withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const compressed = `data:image/jpeg;base64,${outputBuffer.toString('base64')}`;

    return NextResponse.json({ photoUrl: compressed });
  } catch (err) {
    console.error('POST /api/wishlist/upload-image error:', err);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}
