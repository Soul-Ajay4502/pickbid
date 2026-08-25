'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, LoaderCircle } from 'lucide-react';

/**
 * The owner's way in. Deliberately unlinked from anywhere in the product — no
 * nav entry, no footer link — and it never mentions Google sign-in, because the
 * admin account isn't a user account.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const { error: message } = await res.json().catch(() => ({ error: '' }));
        setError(message || 'Invalid credentials');
        setPassword('');
        return;
      }
      // Replace so the back button can't land on the login form post-auth.
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-125 h-125 rounded-full bg-green-500/5 blur-[120px] pointer-events-none" />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm rounded-2xl border border-foreground/10 bg-foreground/4 backdrop-blur p-7 space-y-5"
      >
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-11 h-11 rounded-2xl bg-linear-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-green-500 dark:text-green-400" />
          </div>
          <h1 className="text-xl font-black tracking-tight">Owner Console</h1>
          <p className="text-xs text-muted-foreground">Restricted access. Authorised operator only.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Email
          </Label>
          <Input
            id="email" name="email" type="email" autoComplete="username" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Password
          </Label>
          <Input
            id="password" name="password" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>
        )}

        <Button
          type="submit" disabled={loading || !email || !password}
          className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold btn-glow-green"
        >
          {loading && <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />}
          {loading ? 'Verifying…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
