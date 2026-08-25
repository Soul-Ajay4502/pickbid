import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/adminAuth';
import AdminDashboard from './AdminDashboard';

// The owner console is never indexed and never cached.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Owner Console',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // The proxy only checks that *a* cookie is present; this verifies its
  // signature and expiry before any admin markup is rendered.
  if (!(await isAdmin())) redirect('/admin/login');
  return <AdminDashboard />;
}
