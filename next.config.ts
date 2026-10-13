import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / WASM packages used by the upload pipeline must not be bundled.
  serverExternalPackages: ["sharp", "pdfjs-dist", "@napi-rs/canvas"],
  // The watermark font is read from disk at runtime; make sure it ships with the upload function.
  // pdf.js loads its worker file from next to itself at runtime; it is not imported anywhere, so it has to be listed.
  outputFileTracingIncludes: {
    "/api/uploads/*": ["./src/assets/**", "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    "/api/jobs/*": ["./src/assets/**"],
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
