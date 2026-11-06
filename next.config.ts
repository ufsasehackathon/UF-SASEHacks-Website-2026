import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E tests run their own dev server in a separate folder so they don't clobber `npm run dev`
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
