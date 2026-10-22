import type { NextConfig } from "next";
const config: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.STAGEFLOW_API_URL || "http://127.0.0.1:9149"}/api/:path*`,
      },
    ];
  },
  devIndicators: false,
};
export default config;
