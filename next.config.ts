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
};

export default nextConfig;
