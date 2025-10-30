/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "static.inaturalist.org" }
    ]
  },
  experimental: { serverActions: { allowedOrigins: ["*"] } }
};
module.exports = nextConfig;
