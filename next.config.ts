import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browsers send Origin as full URL (e.g. http://192.168.1.91:3000), not just the hostname.
  allowedDevOrigins: ["192.168.1.91", "http://192.168.1.91:3000"],
};

export default nextConfig;
