import { Activity } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// Presentational bar chart of daily access counts (no chart library).
export interface DayCount {
  date: string // YYYY-MM-DD
  count: number
}

export default function AccessTimeline({ days }: { days: DayCount[] }) {
  const peak = Math.max(1, ...days.map((d) => d.count))
  const total = days.reduce((sum, d) => sum + d.count, 0)
  const empty = total === 0

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Activity className="size-4 text-muted-foreground" />
          Access activity · last 14 days
        </CardTitle>
        {!empty && (
          <span className="text-xs text-muted-foreground">
            peak <span className="font-medium text-foreground">{peak}</span>/day
          </span>
        )}
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
            <Activity className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No access recorded in this window.
            </p>
          </div>
        ) : (
          <div className="flex h-48 items-end gap-1.5">
            {days.map((d, i) => (
              <div
                key={d.date}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <div className="flex h-full w-full items-end justify-center">
                  <div
                    className="w-full max-w-10 rounded-t-md bg-chart-1 opacity-80 transition-all group-hover:opacity-100"
                    style={{
                      height: `${Math.max((d.count / peak) * 100, d.count > 0 ? 4 : 0)}%`,
                    }}
                    title={`${d.date}: ${d.count} ${d.count === 1 ? 'access' : 'accesses'}`}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {i % 2 === 0 ? d.date.slice(5) : ' '}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
