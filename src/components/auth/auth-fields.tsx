'use client'

import * as React from 'react'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'

import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'

/**
 * Email and password inputs shared by every auth screen.
 *
 * Four screens each carried their own copy of the icon-inside-the-input
 * markup, hand-positioned with `absolute left-3 top-1/2 -translate-y-1/2`
 * and matching `pl-9` padding on the control. InputGroup owns that
 * geometry now, so the icon can't drift out of alignment on one screen
 * and the reveal toggle behaves identically everywhere.
 */
export function EmailField({
  value,
  onChange,
  id = 'email',
  label = 'Email',
  autoComplete = 'email',
}: {
  value: string
  onChange: (value: string) => void
  id?: string
  label?: string
  autoComplete?: string
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupAddon>
          <Mail />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          placeholder="you@example.com"
        />
      </InputGroup>
    </Field>
  )
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  description,
  revealable = true,
  autoFocus,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  description?: string
  revealable?: boolean
  autoFocus?: boolean
}) {
  const [visible, setVisible] = React.useState(false)

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupAddon>
          <Lock />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
        {revealable && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Hide password' : 'Show password'}
              aria-pressed={visible}
            >
              {visible ? <EyeOff /> : <Eye />}
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  )
}

/** "or continue with email" rule between the OAuth button and the form. */
export function AuthDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
