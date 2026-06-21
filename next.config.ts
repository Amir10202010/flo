import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every response. Deliberately conservative
 * — no Content-Security-Policy yet, because Next.js injects inline bootstrap
 * scripts and framer-motion emits inline styles, so a strict CSP needs
 * nonce/hash plumbing (tracked as a follow-up). These headers are safe as-is:
 *   - nosniff           — block MIME-type confusion attacks
 *   - SAMEORIGIN        — clickjacking protection (app is never framed elsewhere)
 *   - Referrer-Policy   — don't leak full URLs (which can carry ids) cross-origin
 *   - HSTS              — force HTTPS once seen (no-op on http/localhost)
 *   - Permissions-Policy— disable device APIs the app never uses
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
