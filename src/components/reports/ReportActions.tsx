'use client'

import { Download, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'

export default function ReportActions({ projectId }: { projectId: string }) {
  return (
    // Two ways to take the same report away: grouped, because they're one
    // family of action rather than two unrelated buttons.
    <ButtonGroup className="print:hidden">
      <Button variant="outline" asChild>
        <a href={`/api/projects/${projectId}/report?format=csv`} download>
          <Download className="size-4" />
          CSV
        </a>
      </Button>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="size-4" />
        Print / PDF
      </Button>
    </ButtonGroup>
  )
}
