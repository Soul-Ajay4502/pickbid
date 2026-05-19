import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateToken(): string {
  return crypto.randomUUID();
}

export function getOrCreateToken(key: string): string {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const token = generateToken();
  localStorage.setItem(key, token);
  return token;
}

/** Convert a league name to a safe Cloudinary folder segment */
export function sanitizeFolder(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'league'
  );
}

/**
 * Upload a File to Cloudinary via the /api/upload route.
 * @param file    The image File to upload
 * @param folder  Cloudinary folder path (e.g. "premier_league/players")
 * @returns       The Cloudinary secure URL
 */
export async function uploadFile(file: File, folder: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Image upload failed');
  const { url } = (await res.json()) as { url: string };
  return url;
}
