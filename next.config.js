/** @type {import('next').NextConfig} */
const crypto = require('crypto');

const nextConfig = {
  reactStrictMode: false,
  // Security headers removed - handled by custom server.js for proper CSP nonce integration
  experimental: {
    // Keep experimental section but remove deprecated option
  },
  // Move serverComponentsExternalPackages to root level (Next.js 15+)
  serverExternalPackages: [],
  // Enable CSP nonce support for inline scripts
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
  // Enable compression in development to prevent chunk loading issues
  compress: process.env.NODE_ENV === 'development',
}

// load env variables
const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  ...nextConfig, // para que `reactStrictMode` esté incluido correctamente
  webpack(config) {
    config.resolve.extensions.push('.ts', '.tsx');
    return config;
  },
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_POWERBI_DESCRIPTIVO_URL: process.env.NEXT_PUBLIC_POWERBI_DESCRIPTIVO_URL,
    NEXT_PUBLIC_POWERBI_TRAFICO_URL: process.env.NEXT_PUBLIC_POWERBI_TRAFICO_URL
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'maps.gstatic.com',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'streetviewpixels-pa.googleapis.com',
        port: '',
        pathname: '**',
      },
    ],
  },
};
