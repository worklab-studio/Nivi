import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@anthropic-ai/sdk'],
  async headers() {
    return [
      {
        source: '/:path*.glb',
        headers: [
          { key: 'Content-Type', value: 'model/gltf-binary' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ]
  },
};

export default nextConfig;
