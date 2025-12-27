import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. 允许 Server Actions 在 Vercel 上运行
  experimental: {
    serverActions: {
      // 在 Vercel 上通常不需要手动配置 allowedOrigins，因为它会自动处理
      // 但为了保险，我们可以允许所有来源，或者这里留空即可
      allowedOrigins: [], 
    },
  },

  // 2. 核心代理配置
  async rewrites() {
    // 优先使用环境变量里的地址，如果没有（比如本地开发），就用默认的空字符串防止报错
    const backendUrl = process.env.BACKEND_URL || "";

    return [
      {
        source: "/api/proxy/:path*",
        // ⚠️ 重点：这里不再写死 cpolar 地址，而是读取变量
        // 这样以后后端地址变了，你在 Vercel 后台改一下就行，不用改代码
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;