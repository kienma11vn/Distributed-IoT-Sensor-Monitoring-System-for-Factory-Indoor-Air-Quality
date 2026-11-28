import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, MapPin } from 'lucide-react';
import { Sensor, SensorReading } from '../types/sensor';

interface SensorCardProps {
  sensor: Sensor;
  latestReading: SensorReading | null;
  isSelected: boolean;
  onSelect: (sensor: Sensor) => void;
}

export const SensorCard: React.FC<SensorCardProps> = ({
  sensor,
  latestReading,
  isSelected,
  onSelect,
}) => {
  const isAlert = latestReading?.isAlert ?? false;
  const displayValue = latestReading ? latestReading.value.toFixed(2) : '--';
  const ratio = latestReading
    ? Math.min((latestReading.value / sensor.threshold) * 100, 100)
    : 0;

  const formattedTime = latestReading
    ? new Date(latestReading.measuredAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Chưa có dữ liệu';

  return (
    <div
      className={`sensor-card ${isAlert ? 'sensor-card--alert' : ''} ${
        isSelected ? 'sensor-card--selected' : ''
      }`}
      onClick={() => onSelect(sensor)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect(sensor);
        }
      }}
    >
      <div className="sensor-card__header">
        <span className="sensor-type-badge">{sensor.sensorType}</span>
        <span className={`status-pill ${isAlert ? 'status-pill--alert' : 'status-pill--normal'}`}>
          {isAlert ? (
            <>
              <AlertTriangle size={14} /> Cảnh báo
            </>
          ) : (
            <>
              <CheckCircle2 size={14} /> Bình thường
            </>
          )}
        </span>
      </div>

      <h3 className="sensor-card__name">{sensor.name}</h3>

      <div className="sensor-card__location">
        <MapPin size={14} />
        <span>{sensor.location}</span>
      </div>

      <div className="sensor-card__metric">
        <span className={`metric-value ${isAlert ? 'metric-value--alert' : ''}`}>
          {displayValue}
        </span>
        <span className="metric-unit">{sensor.unit}</span>
      </div>

      <div className="progress-track">
        <div
          className={`progress-fill ${isAlert ? 'progress-fill--alert' : ''}`}
          style={{ width: `${ratio}%` }}
        />
      </div>

      <div className="sensor-card__footer">
        <span className="footer-item">
          <Activity size={13} />
          Ngưỡng: {sensor.threshold} {sensor.unit}
        </span>
        <span className="footer-item">
          <Clock size={13} />
          {formattedTime}
        </span>
      </div>
    </div>
  );
};