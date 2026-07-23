import { ShieldCheck } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="gradient-orb w-96 h-96 bg-primary -top-48 -left-48" />
      <div className="gradient-orb w-80 h-80 bg-chart-2 -bottom-40 -right-40" />
      <div className="gradient-orb w-64 h-64 bg-primary top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/50 px-4 py-2 mb-4 backdrop-blur">
            <ShieldCheck className="size-5 text-primary" />
            <span className="text-sm font-medium text-foreground">SmartCloud</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Secrets Manager</h1>
          <p className="text-muted-foreground text-sm mt-1">Secure secrets management with encryption</p>
        </div>
        {children}
      </div>
    </div>
  )
}
