import { requireAuth } from "@/lib/auth-helpers"
import { DeveloperClient } from "./developer-client"

export default async function DeveloperPage() {
  const user = await requireAuth()

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1]/20 to-[#6366f1]/5 border border-[#6366f1]/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-th-primary tracking-tight">
                  개발자 API
                </h1>
                <p className="text-sm text-th-dim mt-0.5">
                  MoneyTech 데이터를 당신의 서비스에 통합하세요
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DeveloperClient userId={user.id} />
    </div>
  )
}
