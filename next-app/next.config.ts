import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // web-push uses Node.js built-ins (http/https/net) — keep it out of webpack.
  serverExternalPackages: ['web-push'],
  outputFileTracingRoot: path.join(__dirname),
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ];
  },
};

export default nextConfig;
