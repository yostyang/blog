import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      {
        source: "/posts/:slug.html",
        destination: "/posts/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
