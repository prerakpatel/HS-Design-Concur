import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / WASM packages used by the upload pipeline must not be bundled.
  serverExternalPackages: ["sharp", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
