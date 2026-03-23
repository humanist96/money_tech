"use client"

import { useState } from "react"

const BASE_URL = typeof window !== "undefined"
  ? `${window.location.origin}/api/v1`
  : "https://your-domain.com/api/v1"

interface EndpointDoc {
  method: string
  path: string
  description: string
  params: { name: string; type: string; required: boolean; description: string }[]
  exampleResponse: string
}

const ENDPOINTS: EndpointDoc[] = [
  {
    method: "GET",
    path: "/channels",
    description: "List all channels with stats. Supports filtering by category and pagination.",
    params: [
      { name: "category", type: "string", required: false, description: "Filter by category (e.g. stock, crypto)" },
      { name: "limit", type: "integer", required: false, description: "Results per page (default: 20, max: 100)" },
      { name: "offset", type: "integer", required: false, description: "Pagination offset (default: 0)" },
    ],
    exampleResponse: `{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Channel Name",
      "platform": "youtube",
      "category": "stock",
      "subscriber_count": 150000,
      "hit_rate": 0.65,
      "prediction_intensity_score": 8.2
    }
  ],
  "meta": { "total": 22, "limit": 20, "offset": 0 }
}`,
  },
  {
    method: "GET",
    path: "/predictions",
    description: "Retrieve recent buy/sell predictions with optional filters.",
    params: [
      { name: "asset_code", type: "string", required: false, description: "Filter by asset code (e.g. BTC, 005930)" },
      { name: "direction", type: "string", required: false, description: "Filter by direction: buy or sell" },
      { name: "days", type: "integer", required: false, description: "Lookback period in days (default: 30, max: 365)" },
      { name: "limit", type: "integer", required: false, description: "Max results (default: 50, max: 200)" },
    ],
    exampleResponse: `{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "channel_name": "Channel Name",
      "asset_name": "Bitcoin",
      "asset_code": "BTC",
      "prediction_type": "buy",
      "direction_score": 0.75,
      "price_at_mention": 65000,
      "predicted_at": "2026-03-15T10:00:00Z"
    }
  ],
  "meta": { "count": 50, "limit": 50, "days": 30 }
}`,
  },
  {
    method: "GET",
    path: "/consensus",
    description: "Get asset consensus scores aggregated from all channels.",
    params: [
      { name: "days", type: "integer", required: false, description: "Lookback period (default: 30, max: 365)" },
      { name: "min_channels", type: "integer", required: false, description: "Minimum channel count (default: 2)" },
    ],
    exampleResponse: `{
  "success": true,
  "data": [
    {
      "asset_name": "Samsung",
      "asset_code": "005930",
      "consensus_score": 78,
      "positive_pct": 78.5,
      "negative_pct": 10.2,
      "channel_count": 8,
      "buy_count": 12,
      "sell_count": 3
    }
  ],
  "meta": { "count": 30, "days": 30, "min_channels": 2 }
}`,
  },
  {
    method: "GET",
    path: "/sentiment",
    description: "Get market sentiment gauge and optionally per-asset sentiment.",
    params: [
      { name: "asset_code", type: "string", required: false, description: "Get sentiment for a specific asset" },
    ],
    exampleResponse: `{
  "success": true,
  "data": {
    "overall_score": 62,
    "label": "neutral",
    "category_scores": [
      { "category": "stock", "positive_count": 45, "negative_count": 12, "temperature": 68.2 }
    ],
    "asset_sentiment": {
      "asset_name": "Bitcoin",
      "asset_code": "BTC",
      "sentiment_score": 71,
      "positive_count": 15,
      "negative_count": 3
    }
  }
}`,
  },
]

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <pre className="text-xs font-mono bg-[#0d1117] text-[#c9d1d9] p-4 rounded-lg overflow-x-auto leading-relaxed">
        {children}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-white/10 text-white/60 hover:text-white/90 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}

function EndpointSection({ endpoint }: { endpoint: EndpointDoc }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-500/10 text-emerald-400">
          {endpoint.method}
        </span>
        <code className="text-sm font-mono text-th-primary">{endpoint.path}</code>
      </div>
      <p className="text-sm text-th-dim">{endpoint.description}</p>

      {/* Parameters */}
      {endpoint.params.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-th-dim uppercase tracking-wider mb-2">Parameters</h4>
          <div className="bg-th-hover/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-th-border/50 text-xs text-th-dim">
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-left px-3 py-2 font-medium">Required</th>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.params.map((p) => (
                  <tr key={p.name} className="border-b border-th-border/30 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs text-th-accent">{p.name}</td>
                    <td className="px-3 py-2 text-th-dim text-xs">{p.type}</td>
                    <td className="px-3 py-2 text-th-dim text-xs">{p.required ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 text-th-dim text-xs">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Example request */}
      <div>
        <h4 className="text-xs font-medium text-th-dim uppercase tracking-wider mb-2">Example Request</h4>
        <CodeBlock>{`curl -H "Authorization: Bearer mt_live_your_key_here" \\
  "${BASE_URL}${endpoint.path}"`}</CodeBlock>
      </div>

      {/* Example response */}
      <div>
        <h4 className="text-xs font-medium text-th-dim uppercase tracking-wider mb-2">Example Response</h4>
        <CodeBlock>{endpoint.exampleResponse}</CodeBlock>
      </div>
    </div>
  )
}

export function ApiDocsTab() {
  return (
    <div className="space-y-6">
      {/* Base URL */}
      <div className="bg-th-card border border-th-border rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-th-primary">Base URL</h3>
        <code className="block text-sm font-mono bg-th-hover px-3 py-2 rounded-lg text-th-accent">
          {BASE_URL}
        </code>
      </div>

      {/* Auth */}
      <div className="bg-th-card border border-th-border rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-th-primary">Authentication</h3>
        <p className="text-sm text-th-dim">
          Include your API key in the <code className="font-mono text-th-accent">Authorization</code> header
          with a <code className="font-mono text-th-accent">Bearer</code> prefix.
        </p>
        <CodeBlock>{`Authorization: Bearer mt_live_your_key_here`}</CodeBlock>
      </div>

      {/* Rate Limits */}
      <div className="bg-th-card border border-th-border rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-th-primary">Rate Limits</h3>
        <p className="text-sm text-th-dim">
          Free tier: 100 requests/hour. Pro tier: 1,000 requests/hour.
          Rate limit info is returned in response headers:
        </p>
        <div className="text-sm text-th-dim space-y-1">
          <div><code className="font-mono text-th-accent">X-RateLimit-Limit</code> — Max requests per hour</div>
          <div><code className="font-mono text-th-accent">X-RateLimit-Remaining</code> — Remaining requests</div>
        </div>
      </div>

      {/* Endpoints */}
      <div className="bg-th-card border border-th-border rounded-2xl p-5 space-y-8">
        <h3 className="text-sm font-semibold text-th-primary">Endpoints</h3>
        {ENDPOINTS.map((ep) => (
          <div key={ep.path}>
            <EndpointSection endpoint={ep} />
            <div className="mt-6 border-b border-th-border/30 last:border-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
