import { ShieldCheck } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Decorative blurred gradient orbs — kept subtle in light mode so they
          never wash out the form, a touch richer in dark. */}
      <div className="gradient-orb -top-48 -left-48 size-96 bg-primary opacity-20 dark:opacity-40" />
      <div className="gradient-orb -bottom-40 -right-40 size-80 bg-chart-2 opacity-20 dark:opacity-40" />
      <div className="gradient-orb top-1/2 left-1/2 size-64 -translate-x-1/2 -translate-y-1/2 bg-primary opacity-10 dark:opacity-25" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="brand-gradient mb-4 flex size-12 items-center justify-center rounded-2xl text-white shadow-lg shadow-primary/25">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            SmartCloud
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Secure secrets management
          </p>
        </div>

        {children}

        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          Protected with AES-256-GCM encryption
        </p>
      </div>
    </div>
  )
}
