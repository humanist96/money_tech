"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { Component, type ReactNode } from "react"

class AuthErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.children
    }
    return this.props.children
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <AuthErrorBoundary>
      <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
    </AuthErrorBoundary>
  )
}
