'use client'

import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ReportActions({ projectId }: { projectId: string }) {
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="outline" asChild>
        <a href={`/api/projects/${projectId}/report?format=csv`} download>
          <Download className="size-4" />
          Download CSV
        </a>
      </Button>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="size-4" />
        Print / Save as PDF
      </Button>
    </div>
  )
}
