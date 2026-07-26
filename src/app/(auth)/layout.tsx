import Link from 'next/link'
import { Lock, ShieldCheck } from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Decorative wash. Kept well below the form's contrast budget so
          it never competes with the text sitting on top of it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="gradient-orb -top-40 -left-32 size-[28rem] bg-brand opacity-[0.12] dark:opacity-25" />
        <div className="gradient-orb top-1/3 -right-32 size-96 bg-chart-2 opacity-[0.1] dark:opacity-20" />
      </div>

      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <Link
              href="/"
              className="brand-gradient mb-4 flex size-12 items-center justify-center rounded-xl text-white shadow-[var(--shadow-e2)]"
              aria-label="SmartCloud home"
            >
              <ShieldCheck className="size-6" />
            </Link>
            <h1 className="text-lg font-semibold">SmartCloud</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Secure secrets management
            </p>
          </div>

          {children}

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            Protected with AES-256-GCM encryption
          </p>
        </div>
      </div>
    </div>
  )
}
