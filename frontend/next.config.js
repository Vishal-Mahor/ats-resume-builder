/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
  },
  async rewrites() {
    // Proxy /api/v1/* to backend in dev (optional — can use env var directly)
    return [];
  },
};

module.exports = nextConfig;
