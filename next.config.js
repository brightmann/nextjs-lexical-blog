const WebpackObfuscator = require("webpack-obfuscator");
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "github.com" },
    ],
  },
  // webpack: (config, { dev }) => {
  //   if (!dev) {
  //     config.plugins.push(new WebpackObfuscator({ rotateStringArray: true }));
  //   }
  //   return config;
  // },
  // experimental: {
  //   webpackBuildWorker: true,
  // },
};

//module.exports = nextConfig;
module.exports = nextConfig;
