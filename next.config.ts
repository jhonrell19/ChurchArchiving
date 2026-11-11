import type { NextConfig } from "next";



const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  allowedDevOrigins: [
  "exporter-lily-shack.ngrok-free.dev",
],

 experimental: {
    proxyClientMaxBodySize: '100mb',
  },
};



export default nextConfig;

