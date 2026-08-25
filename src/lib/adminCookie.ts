/**
 * The super-admin session cookie name, in a module of its own so both
 * `adminAuth.ts` (which imports `next/headers`) and `proxy.ts` (which must not)
 * can share the constant without the proxy pulling request-scoped APIs into its
 * bundle.
 */
export const ADMIN_COOKIE = 'pickbid_admin';
