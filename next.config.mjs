/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["bcrypt", "@prisma/client", "prisma"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn-assets-eu.frontify.com",
        pathname: "/s3/frontify-enterprise-files-eu/**",
      },
    ],
  },
};

export default nextConfig;
