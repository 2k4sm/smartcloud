import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Presentational bar chart of daily access counts (no chart library).
export interface DayCount {
  date: string // YYYY-MM-DD
  count: number
}

export default function AccessTimeline({ days }: { days: DayCount[] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Access activity (14 days)</CardTitle>
      </CardHeader>
      <CardContent>
        {days.every((d) => d.count === 0) ? (
          <p className="text-xs text-muted-foreground">
            No access recorded in this window.
          </p>
        ) : (
          <div className="flex h-32 items-end gap-1">
            {days.map((d) => (
              <div
                key={d.date}
                className="group flex flex-1 flex-col items-center gap-1"
              >
                <div className="flex h-full w-full items-end">
                  <div
                    className="brand-gradient w-full rounded-t opacity-70 transition-opacity group-hover:opacity-100"
                    style={{ height: `${(d.count / max) * 100}%` }}
                    title={`${d.date}: ${d.count}`}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">
                  {d.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
