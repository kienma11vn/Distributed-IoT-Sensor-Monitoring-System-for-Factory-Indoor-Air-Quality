export interface Sensor {
  id: string;
  name: string;
  sensorType: string;
  location: string;
  unit: string;
  threshold: number;
  createdAt: string;
}

export interface CreateSensorRequest {
  name: string;
  sensorType: string;
  location: string;
  unit: string;
  threshold: number;
}

export interface SensorReading {
  id: number;
  sensorId: string;
  sensorName: string;
  sensorType: string;
  location: string;
  unit: string;
  value: number;
  threshold: number;
  isAlert: boolean;
  measuredAt: string;
  processedAt: string;
}

export interface AlertNotification {
  readingId?: number | null;
  sensorId: string;
  sensorName: string;
  sensorType: string;
  location: string;
  unit: string;
  value: number;
  threshold: number;
  isAlert: boolean;
  severity: 'WARNING' | 'CRITICAL' | string;
  message: string;
  measuredAt: string;
  triggeredAt: string;
}