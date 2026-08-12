import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.12", "10.0.241.200"],
  devIndicators: false,
};

export default nextConfig;
