"use client"

import { signIn } from "next-auth/react"
import Link from "next/link"

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00e8b8] to-[#00b894] shadow-[0_0_40px_rgba(0,232,184,0.15)] mb-4">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-th-primary mb-2" style={{ fontFamily: "var(--font-outfit)" }}>
            MoneyTech 로그인
          </h1>
          <p className="text-sm text-th-muted">
            재테크 콘텐츠 분석을 위한 개인화된 경험
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card-elevated rounded-2xl p-8">
          <div className="space-y-3">
            {/* Google Login */}
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-[#0e1a30] border border-th-border text-sm font-medium text-th-primary transition-all hover:border-th-strong hover:shadow-lg"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google로 계속하기
            </button>

            {/* Kakao Login */}
            <button
              onClick={() => signIn("kakao", { callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#FEE500] text-[#191919] text-sm font-medium transition-all hover:bg-[#FADA0A] hover:shadow-lg"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#191919">
                <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.72 1.8 5.108 4.517 6.454-.197.735-.715 2.665-.82 3.079-.13.516.19.509.398.37.163-.109 2.6-1.768 3.654-2.487.727.104 1.48.16 2.251.16 5.523 0 10-3.463 10-7.576C22 6.463 17.523 3 12 3z" />
              </svg>
              카카오로 계속하기
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-th-border" />
            <span className="text-xs text-th-dim">또는</span>
            <div className="flex-1 h-px bg-th-border" />
          </div>

          {/* Guest Continue */}
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-th-border text-sm font-medium text-th-muted transition-all hover:text-th-primary hover:border-th-strong hover:bg-th-hover"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            게스트로 계속하기
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-th-dim mt-6">
          로그인 시{" "}
          <span className="text-th-muted underline cursor-pointer">이용약관</span>
          {" "}및{" "}
          <span className="text-th-muted underline cursor-pointer">개인정보처리방침</span>
          에 동의합니다.
        </p>
      </div>
    </div>
  )
}
