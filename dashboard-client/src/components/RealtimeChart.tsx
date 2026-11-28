import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Filter, RefreshCw } from 'lucide-react';
import { Sensor, SensorReading } from '../types/sensor';

export type TimeRangeKey = '15m' | '1h' | '6h' | '24h' | 'all';

interface RealtimeChartProps {
  sensor: Sensor | null;
  readings: SensorReading[];
  timeRange: TimeRangeKey;
  isLoading: boolean;
  onTimeRangeChange: (range: TimeRangeKey) => void;
  onRefresh: () => void;
}

const TIME_RANGES: { key: TimeRangeKey; label: string }[] = [
  { key: '15m', label: '15 phút' },
  { key: '1h', label: '1 giờ' },
  { key: '6h', label: '6 giờ' },
  { key: '24h', label: '24 giờ' },
  { key: 'all', label: 'Gần nhất' },
];

export const RealtimeChart: React.FC<RealtimeChartProps> = ({
  sensor,
  readings,
  timeRange,
  isLoading,
  onTimeRangeChange,
  onRefresh,
}) => {
  if (!sensor) {
    return (
      <section className="panel chart-panel">
        <div className="empty-state">Chọn một cảm biến để xem biểu đồ lịch sử đo.</div>
      </section>
    );
  }

  const chartData = readings.map((item) => ({
    timeLabel: new Date(item.measuredAt).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    fullTime: new Date(item.measuredAt).toLocaleString('vi-VN'),
    value: item.value,
    threshold: item.threshold,
    isAlert: item.isAlert,
  }));

  const maxDataVal = Math.max(
    sensor.threshold * 1.2,
    ...readings.map((r) => r.value * 1.1)
  );

  return (
    <section className="panel chart-panel">
      <div className="panel__header">
        <div>
          <h2 className="panel__title">Biểu đồ lịch sử: {sensor.name}</h2>
          <p className="panel__subtitle">
            Vị trí: {sensor.location} • Ngưỡng cảnh báo:{' '}
            <strong>
              {sensor.threshold} {sensor.unit}
            </strong>
          </p>
        </div>

        <div className="chart-controls">
          <div className="range-group" role="group" aria-label="Khoảng thời gian">
            <Filter size={14} className="range-group__icon" />
            {TIME_RANGES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`range-btn ${timeRange === item.key ? 'range-btn--active' : ''}`}
                onClick={() => onTimeRangeChange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={onRefresh}
            disabled={isLoading}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="empty-state">
          Chưa có bản ghi lịch sử nào trong khoảng thời gian đã chọn.
        </div>
      ) : (
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 16, right: 24, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="timeLabel"
                tick={{ fontSize: 12, fill: '#64748b' }}
                minTickGap={24}
              />
              <YAxis
                domain={[0, Math.ceil(maxDataVal)]}
                tick={{ fontSize: 12, fill: '#64748b' }}
                unit={` ${sensor.unit}`}
                width={84}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.fullTime ?? ''
                }
                formatter={(value: unknown) => [
                  `${Number(value).toFixed(2)} ${sensor.unit}`,
                  'Giá trị đo',
                ]}
              />
              <ReferenceLine
                y={sensor.threshold}
                stroke="#ef4444"
                strokeDasharray="6 4"
                strokeWidth={2}
                label={{
                  value: `Ngưỡng (${sensor.threshold} ${sensor.unit})`,
                  position: 'insideTopRight',
                  fill: '#dc2626',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (cx == null || cy == null) return <g key={`empty-${cx}`} />;
                  const isAlertPoint = Boolean(payload?.isAlert);
                  return (
                    <circle
                      key={`dot-${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={isAlertPoint ? 5 : 3}
                      fill={isAlertPoint ? '#ef4444' : '#2563eb'}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  );
                }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};