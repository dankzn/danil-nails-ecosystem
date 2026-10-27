/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  transpilePackages: ["@danil-nails/shared"]
};

export default nextConfig;
