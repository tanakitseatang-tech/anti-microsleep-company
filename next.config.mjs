/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // /api/setup reads db/schema.sql at run time: ship that file with the function
    outputFileTracingIncludes: {
      "/api/setup": ["./db/schema.sql"],
    },
  },
};

export default nextConfig;
