/** @type {import('next').NextConfig} */
const nextConfig = {
  // App router is now default, no experimental config needed
  output: 'standalone',
  
  // Environment variables for MinIO
  env: {
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'localhost:9000',
    MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || 'bankuser',
    MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || 'BankPass123!',
    MINIO_USE_SSL: process.env.MINIO_USE_SSL || 'false',
    MINIO_BUCKET: process.env.MINIO_BUCKET || 'crypto-data',
    PYTHON_SERVICE_URL: process.env.PYTHON_SERVICE_URL || 'http://localhost:5000'
  },

  // API rewrites for development
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/python/:path*',
          destination: 'http://localhost:5000/api/:path*'
        }
      ]
    }
    return []
  },

  // Headers for CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
}

module.exports = nextConfig