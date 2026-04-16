'use client'

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Legend,
} from 'recharts'

const COLORS = ['#22C55E', '#E63946', '#EF9F27', '#6366F1', '#3B82F6', '#EC4899', '#14B8A6', '#F97316']

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#252525',
    border: '1px solid #333333',
    borderRadius: '8px',
    color: '#e5e5e5',
    fontSize: '13px',
  },
  itemStyle: { color: '#e5e5e5' },
  labelStyle: { color: '#9ca3af' },
}

export function DarkPieChart({
  data,
  height = 260,
}: {
  data: { name: string; value: number; color?: string }[]
  height?: number
}) {
  const filtered = data.filter((d) => d.value > 0)
  if (filtered.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No data to display.</p>

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={filtered}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
          nameKey="name"
          stroke="none"
        >
          {filtered.map((entry, index) => (
            <Cell key={entry.name} fill={entry.color || COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }}
          formatter={(value: string) => <span className="text-gray-400 text-xs">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function DarkBarChart({
  data,
  bars,
  xKey = 'name',
  height = 300,
  layout = 'vertical',
}: {
  data: Record<string, unknown>[]
  bars: { dataKey: string; color?: string; name?: string }[]
  xKey?: string
  height?: number
  layout?: 'horizontal' | 'vertical'
}) {
  if (data.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No data to display.</p>

  const isVertical = layout === 'vertical'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={isVertical ? 'vertical' : 'horizontal'} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
        {isVertical ? (
          <>
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#333333' }} />
            <YAxis dataKey={xKey} type="category" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#333333' }} width={100} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#333333' }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#333333' }} />
          </>
        )}
        <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
        {bars.length > 1 && (
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            formatter={(value: string) => <span className="text-gray-400 text-xs">{value}</span>}
          />
        )}
        {bars.map((bar, i) => (
          <Bar key={bar.dataKey} dataKey={bar.dataKey} fill={bar.color || COLORS[i % COLORS.length]} name={bar.name || bar.dataKey} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DarkLineChart({
  data,
  lines,
  xKey = 'name',
  height = 300,
}: {
  data: Record<string, unknown>[]
  lines: { dataKey: string; color?: string; name?: string }[]
  xKey?: string
  height?: number
}) {
  if (data.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">No data to display.</p>

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
        <XAxis dataKey={xKey} tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#333333' }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={{ stroke: '#333333' }} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        {lines.length > 1 && (
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            formatter={(value: string) => <span className="text-gray-400 text-xs">{value}</span>}
          />
        )}
        {lines.map((line, i) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.color || COLORS[i % COLORS.length]}
            name={line.name || line.dataKey}
            strokeWidth={2}
            dot={{ fill: line.color || COLORS[i % COLORS.length], r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
