/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow network access during development
  // This enables HMR (hot module reload) from network addresses
  allowedDevOrigins: ['10.0.0.222'],
};

module.exports = nextConfig;
