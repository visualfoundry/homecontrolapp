import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Explicitly set the tracing root to this directory so Next.js doesn't
  // travel up to the parent theme folder and get confused by its package.json.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
