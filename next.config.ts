import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static optimization where possible
  reactStrictMode: true,
  
  // Configure image domains for next/image
  images: {
    domains: ['sdigjxcgoqclmssnmtwi.supabase.co'],
  },
  
  // Configure redirects if needed
  async redirects() {
    return [];
  },
  
  // Configure headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
