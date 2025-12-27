import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        // 👇 重点看这里：我已经帮你换成了新的域名
        destination: "https://18c176f7.r16.cpolar.top/:path*",
      },
    ];
  },
};

export default nextConfig;