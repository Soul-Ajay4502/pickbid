import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a raw buffer to Cloudinary and return the secure URL.
 * @param buffer  Image data
 * @param folder  Cloudinary folder path (e.g. "premier_league/players")
 */
export async function uploadToCloudinary(buffer: Buffer, folder: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error: Error | undefined, result: UploadApiResponse | undefined) => {
        if (error || !result) reject(error ?? new Error('Cloudinary upload failed'));
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

/**
 * Extract the public_id from a Cloudinary delivery URL, or null if the URL
 * is not an asset on this cloud (e.g. a Google avatar).
 * Handles optional transformation and version segments:
 *   https://res.cloudinary.com/<cloud>/image/upload/[w_400,.../][v123/]<public_id>.<ext>
 */
export function cloudinaryPublicId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('res.cloudinary.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if (cloud && parts[0] !== cloud) return null;
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx === -1) return null;
    let rest = parts.slice(uploadIdx + 1);
    while (rest.length > 1 && (rest[0].includes(',') || /^v\d+$/.test(rest[0]))) {
      rest = rest.slice(1);
    }
    if (rest.length === 0) return null;
    rest[rest.length - 1] = rest[rest.length - 1].replace(/\.[^.]+$/, '');
    return decodeURIComponent(rest.join('/'));
  } catch {
    return null;
  }
}

/**
 * Best-effort delete of a Cloudinary asset by its delivery URL.
 * Never throws — a leftover image must not fail the user's actual request.
 */
export async function deleteFromCloudinary(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const publicId = cloudinaryPublicId(url);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.error('Cloudinary delete failed for', publicId, err);
  }
}
