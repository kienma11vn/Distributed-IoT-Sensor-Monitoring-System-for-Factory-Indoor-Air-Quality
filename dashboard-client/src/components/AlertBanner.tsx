import React from 'react';
import { AlertTriangle, Bell, Trash2, X } from 'lucide-react';
import { AlertNotification } from '../types/sensor';

interface AlertBannerProps {
  alerts: AlertNotification[];
  onDismiss: (index: number) => void;
  onClearAll: () => void;
  onSelectSensor: (sensorId: string) => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  alerts,
  onDismiss,
  onClearAll,
  onSelectSensor,
}) => {
  return (
    <section className="panel alert-panel">
      <div className="panel__header">
        <div className="alert-panel__title-wrap">
          <Bell size={18} className="alert-bell-icon" />
          <h2 className="panel__title">Cảnh báo Realtime</h2>
          <span className="alert-count-badge">{alerts.length}</span>
        </div>

        {alerts.length > 0 && (
          <button
            type="button"
            className="text-btn"
            onClick={onClearAll}
            title="Xóa toàn bộ cảnh báo đã hiển thị"
          >
            <Trash2 size={14} /> Xóa tất cả
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="empty-state empty-state--compact">
          Chưa ghi nhận cảnh báo vượt ngưỡng nào. Hệ thống đang giám sát bình thường.
        </div>
      ) : (
        <ul className="alert-list">
          {alerts.map((alert, index) => {
            const isCritical = alert.severity === 'CRITICAL';
            const timeStr = new Date(alert.measuredAt).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <li
                key={`${alert.sensorId}-${alert.triggeredAt}-${index}`}
                className={`alert-item ${isCritical ? 'alert-item--critical' : 'alert-item--warning'}`}
              >
                <div
                  className="alert-item__body"
                  onClick={() => onSelectSensor(alert.sensorId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelectSensor(alert.sensorId);
                    }
                  }}
                >
                  <div className="alert-item__top">
                    <span className={`severity-tag ${isCritical ? 'severity-tag--critical' : ''}`}>
                      <AlertTriangle size={12} /> {alert.severity}
                    </span>
                    <span className="alert-item__time">{timeStr}</span>
                  </div>

                  <p className="alert-item__sensor">
                    {alert.sensorName} ({alert.location})
                  </p>
                  <p className="alert-item__detail">
                    Giá trị đo:{' '}
                    <strong>
                      {alert.value.toFixed(2)} {alert.unit}
                    </strong>{' '}
                    / Ngưỡng: {alert.threshold} {alert.unit}
                  </p>
                </div>

                <button
                  type="button"
                  className="alert-item__close"
                  onClick={() => onDismiss(index)}
                  aria-label="Đóng cảnh báo"
                >
                  <X size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};