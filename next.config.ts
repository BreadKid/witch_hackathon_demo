import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        // 👇 重点看这里：我已经帮你换成了新的域名
        destination: "https://agrostographic-kasie-lullingly.ngrok-free.dev/:path*",
      },
    ];
  },
};

export default nextConfig;