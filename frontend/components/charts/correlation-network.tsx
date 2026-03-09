"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import Link from "next/link"
import type { AssetCorrelation } from "@/lib/types"

interface CorrelationNetworkProps {
  data: AssetCorrelation[]
  title?: string
}

interface Node {
  id: string
  code: string
  x: number
  y: number
  vx: number
  vy: number
  connections: number
  radius: number
}

interface Edge {
  source: string
  target: string
  weight: number
}

export function CorrelationNetwork({ data, title = "종목 상관관계 네트워크" }: CorrelationNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  const animRef = useRef<number>(0)

  const buildGraph = useCallback(() => {
    const nodeMap = new Map<string, number>()

    for (const d of data) {
      nodeMap.set(d.source, (nodeMap.get(d.source) || 0) + d.co_occurrence)
      nodeMap.set(d.target, (nodeMap.get(d.target) || 0) + d.co_occurrence)
    }

    const maxConn = Math.max(...Array.from(nodeMap.values()), 1)

    const nodes: Node[] = Array.from(nodeMap.entries()).map(([name, conn], i) => {
      const angle = (i / nodeMap.size) * Math.PI * 2
      const r = 120 + Math.random() * 40
      const codeEntry = data.find(d => d.source === name || d.target === name)
      return {
        id: name,
        code: (codeEntry?.source === name ? codeEntry.source_code : codeEntry?.target_code) || name,
        x: 250 + Math.cos(angle) * r,
        y: 200 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        connections: conn,
        radius: 12 + (conn / maxConn) * 18,
      }
    })

    const edges: Edge[] = data.map(d => ({
      source: d.source,
      target: d.target,
      weight: d.co_occurrence,
    }))

    nodesRef.current = nodes
    edgesRef.current = edges
  }, [data])

  useEffect(() => {
    if (data.length === 0) return
    buildGraph()

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const W = rect.width
    const H = rect.height
    const maxWeight = Math.max(...edgesRef.current.map(e => e.weight), 1)

    let frame = 0

    function simulate() {
      const nodes = nodesRef.current
      const edges = edgesRef.current

      // Simple force simulation
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const repulsion = 2000 / (dist * dist)
          const fx = (dx / dist) * repulsion
          const fy = (dy / dist) * repulsion
          nodes[i].vx -= fx
          nodes[i].vy -= fy
          nodes[j].vx += fx
          nodes[j].vy += fy
        }
      }

      for (const edge of edges) {
        const s = nodes.find(n => n.id === edge.source)
        const t = nodes.find(n => n.id === edge.target)
        if (!s || !t) continue
        const dx = t.x - s.x
        const dy = t.y - s.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const idealDist = 100 + (1 - edge.weight / maxWeight) * 80
        const force = (dist - idealDist) * 0.003
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        s.vx += fx
        s.vy += fy
        t.vx -= fx
        t.vy -= fy
      }

      // Center gravity
      for (const node of nodes) {
        node.vx += (W / 2 - node.x) * 0.001
        node.vy += (H / 2 - node.y) * 0.001
        node.vx *= 0.85
        node.vy *= 0.85
        node.x += node.vx
        node.y += node.vy
        node.x = Math.max(node.radius + 10, Math.min(W - node.radius - 10, node.x))
        node.y = Math.max(node.radius + 10, Math.min(H - node.radius - 10, node.y))
      }
    }

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)

      const nodes = nodesRef.current
      const edges = edgesRef.current

      // Draw edges
      for (const edge of edges) {
        const s = nodes.find(n => n.id === edge.source)
        const t = nodes.find(n => n.id === edge.target)
        if (!s || !t) continue

        const isHovered = hoveredNode === s.id || hoveredNode === t.id
        const alpha = isHovered ? 0.6 : hoveredNode ? 0.08 : 0.2
        const width = 1 + (edge.weight / maxWeight) * 3

        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(t.x, t.y)
        ctx.strokeStyle = isHovered
          ? `rgba(0, 232, 184, ${alpha})`
          : `rgba(124, 108, 240, ${alpha})`
        ctx.lineWidth = width
        ctx.stroke()

        // Weight label on edge
        if (isHovered) {
          const mx = (s.x + t.x) / 2
          const my = (s.y + t.y) / 2
          ctx.fillStyle = "rgba(255,255,255,0.6)"
          ctx.font = "9px system-ui"
          ctx.textAlign = "center"
          ctx.fillText(`${edge.weight}`, mx, my - 4)
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const isHovered = hoveredNode === node.id
        const isConnected = hoveredNode
          ? edges.some(e => (e.source === hoveredNode && e.target === node.id) || (e.target === hoveredNode && e.source === node.id))
          : false
        const dimmed = hoveredNode && !isHovered && !isConnected

        // Glow
        if (isHovered) {
          const gradient = ctx.createRadialGradient(node.x, node.y, node.radius, node.x, node.y, node.radius * 2.5)
          gradient.addColorStop(0, "rgba(0, 232, 184, 0.2)")
          gradient.addColorStop(1, "rgba(0, 232, 184, 0)")
          ctx.beginPath()
          ctx.arc(node.x, node.y, node.radius * 2.5, 0, Math.PI * 2)
          ctx.fillStyle = gradient
          ctx.fill()
        }

        // Node circle
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
        ctx.fillStyle = isHovered
          ? "rgba(0, 232, 184, 0.25)"
          : dimmed
            ? "rgba(14, 26, 48, 0.5)"
            : "rgba(14, 26, 48, 0.8)"
        ctx.fill()
        ctx.strokeStyle = isHovered
          ? "rgba(0, 232, 184, 0.8)"
          : dimmed
            ? "rgba(26, 39, 68, 0.3)"
            : "rgba(26, 39, 68, 0.8)"
        ctx.lineWidth = isHovered ? 2 : 1
        ctx.stroke()

        // Node label
        ctx.fillStyle = isHovered
          ? "#00e8b8"
          : dimmed
            ? "rgba(90, 106, 136, 0.3)"
            : "#c8d0e0"
        ctx.font = `${isHovered ? "bold " : ""}${node.radius > 20 ? 11 : 10}px system-ui`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(node.id, node.x, node.y)
      }

      frame++
      if (frame < 200) {
        simulate()
      }
      animRef.current = requestAnimationFrame(draw)
    }

    // Start
    for (let i = 0; i < 50; i++) simulate()
    animRef.current = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(animRef.current)
  }, [data, buildGraph, hoveredNode])

  // Mouse interaction
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const found = nodesRef.current.find(n => {
      const dx = n.x - mx
      const dy = n.y - my
      return dx * dx + dy * dy < n.radius * n.radius
    })
    setHoveredNode(found?.id || null)
  }, [])

  if (data.length === 0) {
    return (
      <div className="glass-card-elevated rounded-2xl p-6">
        <h3 className="font-bold text-white text-[15px] mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
        <p className="text-sm text-[#5a6a88]">상관관계 데이터를 수집 중입니다.</p>
      </div>
    )
  }

  // Build legend from top correlated pairs
  const topPairs = data.slice(0, 5)

  return (
    <div className="glass-card-elevated rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1a2744]/50 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white text-[15px]" style={{ fontFamily: 'var(--font-outfit)' }}>{title}</h3>
          <p className="text-[11px] text-[#5a6a88] mt-0.5">같은 영상에서 함께 언급되는 종목 관계</p>
        </div>
        <span className="text-[10px] text-[#3a4a6a]">{nodesRef.current.length}개 종목</span>
      </div>
      <div className="flex flex-col lg:flex-row">
        <div ref={containerRef} className="flex-1 relative" style={{ minHeight: 400 }}>
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ height: 400 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredNode(null)}
          />
        </div>
        <div className="w-full lg:w-56 p-4 border-t lg:border-t-0 lg:border-l border-[#1a2744]/50">
          <h4 className="text-[10px] text-[#475569] uppercase tracking-wider font-medium mb-3">TOP 상관관계</h4>
          <div className="space-y-2">
            {topPairs.map((pair, i) => (
              <div key={i} className="bg-[#0e1a30]/50 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Link
                    href={`/assets/${encodeURIComponent(pair.source_code)}`}
                    className="text-[#00e8b8] font-medium hover:underline"
                  >
                    {pair.source}
                  </Link>
                  <span className="text-[#3a4a6a]">-</span>
                  <Link
                    href={`/assets/${encodeURIComponent(pair.target_code)}`}
                    className="text-[#7c6cf0] font-medium hover:underline"
                  >
                    {pair.target}
                  </Link>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-[#0a1120] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#00e8b8] to-[#7c6cf0]"
                      style={{ width: `${(pair.co_occurrence / data[0].co_occurrence) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#5a6a88] tabular-nums font-medium">
                    {pair.co_occurrence}회
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
