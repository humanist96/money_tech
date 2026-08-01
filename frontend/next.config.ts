import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "yt3.ggpht.com",
      },
      {
        protocol: "https",
        hostname: "yt3.googleusercontent.com",
      },
    ],
  },
  async redirects() {
    // Pages merged or removed in the core-refocus cleanup keep their inbound links working.
    return [
      { source: "/signals", destination: "/", permanent: true },
      { source: "/consensus", destination: "/", permanent: true },
      { source: "/portfolio", destination: "/", permanent: true },
      { source: "/crowd", destination: "/", permanent: true },
      { source: "/backtest", destination: "/leaderboard", permanent: true },
      { source: "/compare", destination: "/channels", permanent: true },
      { source: "/weekly-report", destination: "/leaderboard", permanent: true },
      { source: "/hidden-gems", destination: "/leaderboard", permanent: true },
      { source: "/conflicts", destination: "/briefing", permanent: true },
      { source: "/pricing", destination: "/developer", permanent: true },
      { source: "/notebook", destination: "/", permanent: true },
      { source: "/assistant", destination: "/search", permanent: true },
    ]
  },
}

export default nextConfig
