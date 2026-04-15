/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow network access during development
  // This enables HMR from both localhost and network addresses
  allowedDevOrigins: ['10.0.0.222', 'localhost', '127.0.0.1'],
};

module.exports = nextConfig;
