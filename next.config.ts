import type { NextConfig } from 'next';

/**
 * Static security headers (spec 46.18). The Content-Security-Policy is NOT here: it carries a
 * per-request nonce and is set by src/lib/supabase/middleware.ts.
 *
 *  - X-Content-Type-Options nosniff: no MIME sniffing of responses.
 *  - Referrer-Policy strict-origin-when-cross-origin: full URLs never leak to other sites.
 *  - X-Frame-Options DENY + CSP frame-ancestors 'none': the app is never embedded (clickjacking).
 *  - Permissions-Policy: the game uses none of these browser features, so they are switched off.
 *  - Strict-Transport-Security: two years, subdomains included. Vercel serves HTTPS only; browsers
 *    ignore this header over plain http, so the local stack is unaffected. `preload` is left out on
 *    purpose: submitting to the preload list is a one-way decision for the owner of the domain.
 *  - Cross-Origin-Opener-Policy same-origin: no window.opener access from other origins.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const localBackend = process.env.NEXT_PUBLIC_BACKEND_MODE === 'local' ? process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') : undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Browser source maps stay off in production (Next default); server errors never reach the client anyway.
  productionBrowserSourceMaps: false,
  // Dev servers behind a TLS reverse proxy (preview sandboxes) must accept the proxied origin.
  allowedDevOrigins: ['*.e2b.app', 'localhost'],
  experimental: { serverActions: { bodySizeLimit: '64kb' } },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  async rewrites() {
    // LOCAL STACK ONLY (NEXT_PUBLIC_BACKEND_MODE=local at build time): the browser cannot reach the
    // sandbox's loopback interface, so the browser client talks to /local-backend on this origin and
    // Next proxies it to the local gateway. Production builds have no rewrites at all.
    if (!localBackend) return [];
    return [{ source: '/local-backend/:path*', destination: `${localBackend}/:path*` }];
  },
};

export default nextConfig;
