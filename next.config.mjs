/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  agentRules: false,
  async redirects() {
    return [{ source: "/", destination: "/desk", permanent: false }];
  },
};

export default nextConfig;
