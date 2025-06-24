import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   reactStrictMode: true,
  // Sadece sunucu tarafında erişilebilir env değişkenlerini belirtmek için.
  // Bu durumda zaten process.env otomatik olarak sadece sunucu tarafında erişilebilir olur
  // ancak bu açıkça belirtmek için bir yol olabilir.
  // env: {
  //   BINANCE_API_KEY: process.env.BINANCE_API_KEY,
  //   BINANCE_API_SECRET: process.env.BINANCE_API_SECRET,
  // },
};

export default nextConfig;
