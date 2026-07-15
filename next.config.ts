import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/export/pdf": ["./src/modules/reports/fonts/**/*"],
  },
};

export default nextConfig;
