'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Copy-to-clipboard with the "turns into a tick for two seconds"
 * confirmation. Four screens had their own copy of this state machine;
 * this is the single one.
 */
export function CopyButton({
  value,
  label = 'Copy',
  toastMessage = 'Copied to clipboard',
  variant = 'ghost',
  size = 'icon-sm',
  showLabel = false,
  className,
}: {
  value: string
  label?: string
  toastMessage?: string
  variant?: React.ComponentProps<typeof Button>['variant']
  size?: React.ComponentProps<typeof Button>['size']
  showLabel?: boolean
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)

  // Clear the pending reset if the button unmounts mid-countdown.
  React.useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(id)
  }, [copied])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(toastMessage)
    } catch {
      toast.error('Could not access the clipboard')
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={showLabel ? (size === 'icon-sm' ? 'sm' : size) : size}
      onClick={handleCopy}
      className={cn('shrink-0', className)}
      aria-label={label}
      title={label}
    >
      {copied ? (
        <Check className="size-4 text-success" />
      ) : (
        <Copy className="size-4" />
      )}
      {showLabel && (copied ? 'Copied' : label)}
    </Button>
  )
}
