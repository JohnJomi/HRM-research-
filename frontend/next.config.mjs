/** @type {import('next').NextConfig} */
const backend = process.env.HRM_BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,
  // Same-origin /api/* in the browser -> local FastAPI. Keeps SSE working and
  // avoids CORS entirely.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
