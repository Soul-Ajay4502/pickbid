import type { MetadataRoute } from 'next';
import { SITE_NAME, SITE_DESCRIPTION, BRAND } from '@/lib/seo';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pickbid — cricket league manager',
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: BRAND.bg,
    theme_color: BRAND.green,
    categories: ['sports', 'productivity'],
    icons: [
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
