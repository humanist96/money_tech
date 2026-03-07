import type { Metadata } from "next"
import { Outfit, Noto_Sans_KR } from "next/font/google"
import Link from "next/link"
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

export const metadata: Metadata = {
  title: "MoneyTech - 재테크 유튜브 분석",
  description: "주식, 코인, 부동산, 경제 유튜브 채널을 분석하는 대시보드",
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#94a3b8] transition-all duration-200 hover:text-[#00d4aa] hover:bg-[#00d4aa]/5"
    >
      {icon}
      {label}
    </Link>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className={`${outfit.variable} ${notoSansKR.variable} antialiased min-h-screen`}>
        <header className="sticky top-0 z-50 w-full border-b border-[#1e293b]/60 bg-[#050a18]/80 backdrop-blur-xl">
          <div className="max-w-[1400px] mx-auto flex h-16 items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d4aa] to-[#00d4aa]/60 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#050a18" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#00d4aa] pulse-dot" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white" style={{ fontFamily: 'var(--font-outfit)' }}>
                Money<span className="text-[#00d4aa]">Tech</span>
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              <NavLink
                href="/"
                label="대시보드"
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                  </svg>
                }
              />
              <NavLink
                href="/channels"
                label="채널"
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                }
              />
              <NavLink
                href="/trends"
                label="트렌드"
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                  </svg>
                }
              />
            </nav>
          </div>
        </header>
        <main className="max-w-[1400px] mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
