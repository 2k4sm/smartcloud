// Presentational bar chart of daily access counts (no chart library).
export interface DayCount {
  date: string // YYYY-MM-DD
  count: number
}

export default function AccessTimeline({ days }: { days: DayCount[] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <div className="glass-card p-5">
      <h2 className="text-white font-medium text-sm mb-4">Access activity (14 days)</h2>
      {days.every((d) => d.count === 0) ? (
        <p className="text-gray-500 text-xs">No access recorded in this window.</p>
      ) : (
        <div className="flex items-end gap-1 h-32">
          {days.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="w-full flex items-end h-full">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-blue-500/70 to-cyan-400/70 group-hover:from-blue-500 group-hover:to-cyan-400 transition-colors"
                  style={{ height: `${(d.count / max) * 100}%` }}
                  title={`${d.date}: ${d.count}`}
                />
              </div>
              <span className="text-[9px] text-gray-600">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
