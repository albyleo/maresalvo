import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cesium viene transpilato per compatibilità con il bundler.
  transpilePackages: ["cesium"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default nextConfig;
