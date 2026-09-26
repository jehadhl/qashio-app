/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The repo lives on a Windows drive mounted in WSL (/mnt/c), where file-change
  // events don't reach Linux, so poll for changes in dev instead. Polling tens of
  // thousands of node_modules files over /mnt/c eats CPU and slows every compile,
  // so only our own source is watched.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**', '**/.next/**', '**/.git/**', '**/data/**'],
      };
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/transactions',
        permanent: true,
      },
    ];
  },
}

module.exports = nextConfig 