'use client'

export default function ReportActions({ projectId }: { projectId: string }) {
  return (
    <div className="flex items-center gap-2 print:hidden">
      <a
        href={`/api/projects/${projectId}/report?format=csv`}
        className="btn-secondary text-sm"
        download
      >
        Download CSV
      </a>
      <button onClick={() => window.print()} className="btn-primary text-sm">
        Print / Save as PDF
      </button>
    </div>
  )
}
