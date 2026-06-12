import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['sensitive-chemistry-feb-gives.trycloudflare.com'],
  async rewrites() {
    return [
      {
        source: '/go-api/:path*',
        destination: 'http://127.0.0.1:8080/api/:path*',
      },
    ]
  },
};

export default nextConfig;
