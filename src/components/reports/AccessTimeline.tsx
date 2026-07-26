'use client'

import { Activity } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export interface DayCount {
  date: string // YYYY-MM-DD
  count: number
}

/**
 * Daily access counts over the reporting window.
 *
 * One series measured over time, so this is an area chart in a single
 * hue — the brand blue, which is a step of the same ramp the rest of
 * the UI uses. A single series needs no legend (the card title names
 * it); the peak is called out directly in the header rather than
 * labelling every point, and the hover layer carries exact values.
 */
const chartConfig = {
  count: {
    label: 'Accesses',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

function formatDay(date: string) {
  // Parse as UTC to match how the buckets were built, so a bar never
  // shifts a day for readers west of Greenwich.
  const d = new Date(`${date}T00:00:00Z`)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export default function AccessTimeline({ days }: { days: DayCount[] }) {
  const peak = Math.max(0, ...days.map((d) => d.count))
  const total = days.reduce((sum, d) => sum + d.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" aria-hidden />
          Access activity
        </CardTitle>
        <CardDescription>
          {total > 0 ? (
            <>
              {total} {total === 1 ? 'access' : 'accesses'} over the last{' '}
              {days.length} days · peak{' '}
              <span className="font-medium text-foreground tabular-nums">
                {peak}
              </span>
              /day
            </>
          ) : (
            `Last ${days.length} days`
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Activity />
              </EmptyMedia>
              <EmptyTitle>No access in this window</EmptyTitle>
              <EmptyDescription>
                Reads and writes through the SDK, CLI or dashboard will show
                up here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-52 w-full sm:h-64"
          >
            <AreaChart
              accessibilityLayer
              data={days}
              margin={{ left: 4, right: 8, top: 8 }}
            >
              <defs>
                <linearGradient id="accessFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-count)"
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-count)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>

              {/* Horizontal rules only — vertical ones add ink without
                  helping anyone read a daily count. */}
              <CartesianGrid vertical={false} strokeDasharray="3 3" />

              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={formatDay}
              />
              <YAxis
                width={32}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
              />

              <ChartTooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatDay(String(value))}
                    indicator="dot"
                  />
                }
              />

              <Area
                dataKey="count"
                type="monotone"
                fill="url(#accessFill)"
                stroke="var(--color-count)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
