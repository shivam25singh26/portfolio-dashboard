import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['sensitive-chemistry-feb-gives.trycloudflare.com'],
  async rewrites() {
    // Check if we are given a cloud backend URL, otherwise default to local
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080';
    return [
      {
        source: '/go-api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
};

export default nextConfig;
