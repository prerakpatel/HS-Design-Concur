import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
