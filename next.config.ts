import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1", "**.agent.cvm.dev"],
  // The card reader runs in the browser. Keep its WASM out of the Netlify function bundle.
  serverExternalPackages: ["tesseract.js", "tesseract.js-core"],
  outputFileTracingExcludes: {
    "*": ["./node_modules/tesseract.js/**/*", "./node_modules/tesseract.js-core/**/*"],
  },
};

export default nextConfig;
