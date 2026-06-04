import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // For LAN/mobile testing, add your machine's IP here (hostname and full Origin URL).
  // Browsers send Origin as a full URL (e.g. http://192.168.0.10:3000), not just the hostname.
  allowedDevOrigins: [],
};

export default nextConfig;
