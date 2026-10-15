import type { NextConfig } from "next";

/**
 * Headers every page and file is sent with. None of them changes what the app can do for a signed-in person:
 * - the app cannot be shown inside another site's frame (clickjacking), and nothing may take over its base address or plugins;
 * - browsers must trust the type each file says it is, and send other sites only the origin when following a link out;
 * - the microphone stays available to the app itself (voice input), while camera, location and payment are off.
 * A full script policy (CSP) is deliberately not set: it would need testing against every page, sign-in and the upload flow.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), microphone=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() { return [{ source: "/:path*", headers: securityHeaders }]; },
  // Going back to a page seen in the last 30 seconds (the project after opening a design) reuses it instead of asking
  // the server again. The app's own changes still refresh it at once (they revalidate their pages).
  experimental: { staleTimes: { dynamic: 30 } },
  // Native / WASM packages used by the upload pipeline must not be bundled.
  serverExternalPackages: ["sharp", "pdfjs-dist", "@napi-rs/canvas"],
  // The watermark font is read from disk at runtime; make sure it ships with the upload function.
  // pdf.js loads its worker, decoders (JPEG 2000 etc.), fonts and colour profiles from next to itself at runtime; none is imported, so they are listed.
  outputFileTracingIncludes: {
    "/api/uploads/*": ["./src/assets/**", "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", "./node_modules/pdfjs-dist/{wasm,standard_fonts,cmaps,iccs}/**"],
  },
  // Every deployment keeps its own copy of each function, and Vercel counts them all against Functions Storage.
  // Vercel runs x64 glibc Linux, so the musl and WebAssembly builds of sharp and canvas are dead weight (~60 MB per function).
  outputFileTracingExcludes: {
    "*": [
      "./node_modules/@napi-rs/canvas-linux-x64-musl/**",
      "./node_modules/@img/sharp-libvips-linuxmusl-x64/**",
      "./node_modules/@img/sharp-linuxmusl-x64/**",
      "./node_modules/@img/sharp-wasm32/**",
    ],
  },
};

export default nextConfig;
