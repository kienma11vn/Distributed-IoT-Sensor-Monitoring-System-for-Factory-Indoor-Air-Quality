import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Factory, Wifi, WifiOff } from 'lucide-react';
import { sensorApi } from './services/api';
import { alertSignalRClient, ConnectionStatus } from './services/signalr';
import { AlertNotification, Sensor, SensorReading } from './types/sensor';
import { SensorCard } from './components/SensorCard';
import { RealtimeChart, TimeRangeKey } from './components/RealtimeChart';
import { AlertBanner } from './components/AlertBanner';

const POLL_INTERVAL_MS = 3000;
const MAX_ALERTS_IN_FEED = 30;

function computeFromIso(range: TimeRangeKey): string | undefined {
  const now = Date.now();
  const minutesMap: Record<Exclude<TimeRangeKey, 'all'>, number> = {
    '15m': 15,
    '1h': 60,
    '6h': 360,
    '24h': 1440,
  };
  if (range === 'all') return undefined;
  return new Date(now - minutesMap[range] * 60 * 1000).toISOString();
}

export const App: React.FC = () => {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [latestMap, setLatestMap] = useState<Record<string, SensorReading | null>>({});
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('15m');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [signalRStatus, setSignalRStatus] = useState<ConnectionStatus>('disconnected');
  const [apiError, setApiError] = useState<string | null>(null);

  const selectedSensor = useMemo(
    () => sensors.find((s) => s.id === selectedSensorId) ?? null,
    [sensors, selectedSensorId]
  );

  // 1. Tải danh sách cảm biến ban đầu
  const loadSensors = useCallback(async () => {
    try {
      const list = await sensorApi.getSensors();
      setSensors(list);
      setApiError(null);
      setSelectedSensorId((prev) => prev ?? list[0]?.id ?? null);
    } catch {
      setApiError('Không thể kết nối tới Sensor API. Vui lòng kiểm tra trạng thái backend.');
    }
  }, []);

  // 2. Tải dữ liệu đo gần nhất của toàn bộ cảm biến
  const loadLatestReadings = useCallback(async (sensorList: Sensor[]) => {
    if (sensorList.length === 0) return;

    const entries = await Promise.all(
      sensorList.map(async (sensor) => {
        try {
          const latest = await sensorApi.getLatestReading(sensor.id);
          return [sensor.id, latest] as const;
        } catch {
          return [sensor.id, null] as const;
        }
      })
    );

    setLatestMap((prev) => {
      const next = { ...prev };
      for (const [id, reading] of entries) {
        if (reading) next[id] = reading;
      }
      return next;
    });
  }, []);

  // 3. Tải lịch sử dữ liệu của cảm biến đang được chọn theo khoảng thời gian
  const loadHistory = useCallback(async (sensorId: string, range: TimeRangeKey) => {
    setIsHistoryLoading(true);
    try {
      const from = computeFromIso(range);
      const data = await sensorApi.getReadingHistory(sensorId, {
        from,
        limit: range === 'all' ? 50 : 200,
      });
      setHistory(data);
    } catch {
      // Giữ nguyên biểu đồ hiện tại nếu có lỗi mạng thoáng qua
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSensors();
  }, [loadSensors]);

  // Polling định kỳ để cập nhật trạng thái gần thời gian thực cho thẻ và biểu đồ
  useEffect(() => {
    if (sensors.length === 0) return;

    loadLatestReadings(sensors);
    const timer = window.setInterval(() => {
      loadLatestReadings(sensors);
      if (selectedSensorId) {
        loadHistory(selectedSensorId, timeRange);
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [sensors, selectedSensorId, timeRange, loadLatestReadings, loadHistory]);

  // Tải ngay lịch sử khi người dùng đổi cảm biến hoặc đổi bộ lọc thời gian
  useEffect(() => {
    if (selectedSensorId) {
      loadHistory(selectedSensorId, timeRange);
    }
  }, [selectedSensorId, timeRange, loadHistory]);

  // 4. Kết nối SignalR nhận cảnh báo vượt ngưỡng tức thì từ Notification Service
  useEffect(() => {
    let mounted = true;

    alertSignalRClient
      .start(
        (alert) => {
          if (!mounted) return;

          setAlerts((prev) => [alert, ...prev].slice(0, MAX_ALERTS_IN_FEED));

          // Đồng bộ ngay giá trị vượt ngưỡng lên SensorCard mà không cần chờ nhịp polling
          setLatestMap((prev) => ({
            ...prev,
            [alert.sensorId]: {
              id: alert.readingId ?? Date.now(),
              sensorId: alert.sensorId,
              sensorName: alert.sensorName,
              sensorType: alert.sensorType,
              location: alert.location,
              unit: alert.unit,
              value: alert.value,
              threshold: alert.threshold,
              isAlert: true,
              measuredAt: alert.measuredAt,
              processedAt: alert.triggeredAt,
            },
          }));
        },
        (status) => {
          if (mounted) setSignalRStatus(status);
        }
      )
      .catch(() => {
        if (mounted) setSignalRStatus('disconnected');
      });

    return () => {
      mounted = false;
      alertSignalRClient.stop();
    };
  }, []);

  const alertSensorCount = useMemo(
    () => Object.values(latestMap).filter((r) => r?.isAlert).length,
    [latestMap]
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <div className="brand-icon">
            <Factory size={22} />
          </div>
          <div>
            <h1 className="topbar__title">Giám Sát Chất Lượng Không Khí Nhà Máy</h1>
            <p className="topbar__subtitle">
              Hệ thống IoT phân tán • {sensors.length} cảm biến đang hoạt động •{' '}
              <span className={alertSensorCount > 0 ? 'text-danger' : 'text-ok'}>
                {alertSensorCount} cảm biến vượt ngưỡng
              </span>
            </p>
          </div>
        </div>

        <div className={`connection-badge connection-badge--${signalRStatus}`}>
          {signalRStatus === 'connected' ? <Wifi size={15} /> : <WifiOff size={15} />}
          <span>
            {signalRStatus === 'connected' && 'SignalR: Đã kết nối'}
            {signalRStatus === 'reconnecting' && 'SignalR: Đang kết nối lại...'}
            {signalRStatus === 'disconnected' && 'SignalR: Mất kết nối'}
          </span>
        </div>
      </header>

      {apiError && <div className="error-banner">{apiError}</div>}

      <main className="dashboard-content">
        <section className="sensor-grid" aria-label="Danh sách cảm biến">
          {sensors.map((sensor) => (
            <SensorCard
              key={sensor.id}
              sensor={sensor}
              latestReading={latestMap[sensor.id] ?? null}
              isSelected={sensor.id === selectedSensorId}
              onSelect={(s) => setSelectedSensorId(s.id)}
            />
          ))}
        </section>

        <div className="workspace-grid">
          <RealtimeChart
            sensor={selectedSensor}
            readings={history}
            timeRange={timeRange}
            isLoading={isHistoryLoading}
            onTimeRangeChange={setTimeRange}
            onRefresh={() => {
              if (selectedSensorId) loadHistory(selectedSensorId, timeRange);
            }}
          />

          <AlertBanner
            alerts={alerts}
            onDismiss={(index) =>
              setAlerts((prev) => prev.filter((_, i) => i !== index))
            }
            onClearAll={() => setAlerts([])}
            onSelectSensor={(sensorId) => setSelectedSensorId(sensorId)}
          />
        </div>
      </main>
    </div>
  );
};

export default App;