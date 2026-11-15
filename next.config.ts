import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E tests run their own dev server in a separate folder so they don't clobber `npm run dev`
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    unoptimized: true,
  },
  experimental: {
    // Resume and Devpost CSV uploads go through server actions (default limit 1 MB). Vercel caps
    // request bodies at ~4.5 MB. Keep in sync with MAX_RESUME_BYTES and MAX_CSV_BYTES.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
