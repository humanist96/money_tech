"use client"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | "...")[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push("...")
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push("...")
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-center gap-1 py-3">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-2 py-1 text-[11px] rounded-lg text-th-dim hover:bg-th-hover/50 disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        &lt;
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="px-1 text-[11px] text-th-dim">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`min-w-[28px] py-1 text-[11px] rounded-lg transition font-medium ${
              p === currentPage
                ? "bg-th-accent/15 text-th-accent border border-th-accent/30"
                : "text-th-dim hover:bg-th-hover/50"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-2 py-1 text-[11px] rounded-lg text-th-dim hover:bg-th-hover/50 disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        &gt;
      </button>
    </div>
  )
}
