import type { Metadata, Viewport } from "next"
import { Outfit, Noto_Sans_KR } from "next/font/google"
import Link from "next/link"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionProvider } from "@/components/auth/session-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { NavMenu } from "@/components/nav-menu"
import { MobileNav } from "@/components/mobile-nav"
import { UserMenu } from "@/components/auth/user-menu"
import { NotificationBell } from "@/components/notifications/notification-bell"
import "./globals.css"

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
})

const notoSansKR = Noto_Sans_KR({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: "MoneyTech - 재테크 콘텐츠 분석",
  description: "주식, 코인, 부동산, 경제 콘텐츠를 분석하는 대시보드",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MoneyTech",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#00e8b8" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${outfit.variable} ${notoSansKR.variable} antialiased min-h-screen`}>
        <SessionProvider>
          <ThemeProvider>
            <header className="sticky top-0 z-50 w-full bg-th-header backdrop-blur-2xl border-b border-th-border">
              <div className="max-w-[1440px] mx-auto flex h-[56px] md:h-[60px] items-center justify-between px-4 md:px-6">
                <Link href="/" className="flex items-center gap-2 md:gap-3 group">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#00e8b8] to-[#00b894] dark:from-[#00e8b8] dark:to-[#00b894] flex items-center justify-center shadow-[0_0_20px_rgba(0,232,184,0.2)]">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00e8b8] pulse-dot" />
                  </div>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-lg font-bold tracking-tight text-th-primary" style={{ fontFamily: 'var(--font-outfit)' }}>
                      Money
                    </span>
                    <span className="text-lg font-bold tracking-tight text-th-accent" style={{ fontFamily: 'var(--font-outfit)' }}>
                      Tech
                    </span>
                  </div>
                </Link>

                <div className="flex items-center gap-2">
                  <div className="hidden md:flex items-center gap-2">
                    <NavMenu />
                    <div className="w-px h-5 bg-th-border" />
                    <NotificationBell />
                    <UserMenu />
                  </div>
                  <ThemeToggle />
                </div>
              </div>
            </header>
            <main className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 md:py-8 pb-20 md:pb-8">{children}</main>
            <MobileNav />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
