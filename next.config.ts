import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / WASM packages used by the upload pipeline must not be bundled.
  serverExternalPackages: ["sharp", "pdfjs-dist", "@napi-rs/canvas"],
  // The watermark font is read from disk at runtime; make sure it ships with the upload function.
  outputFileTracingIncludes: { "/api/uploads/*": ["./src/assets/**"], "/api/jobs/*": ["./src/assets/**"] },
};

export default nextConfig;
