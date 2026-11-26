import axios from 'axios';
import {
  CreateSensorRequest,
  Sensor,
  SensorReading,
} from '../types/sensor';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).replace(/\/$/, '');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface HistoryQueryParams {
  from?: string;
  to?: string;
  limit?: number;
}

export const sensorApi = {
  /**
   * Lấy danh sách toàn bộ cảm biến đã đăng ký.
   */
  async getSensors(): Promise<Sensor[]> {
    const response = await apiClient.get<Sensor[]>('/sensors');
    return response.data;
  },

  /**
   * Đăng ký thông tin cảm biến mới kèm ngưỡng cảnh báo.
   */
  async createSensor(payload: CreateSensorRequest): Promise<Sensor> {
    const response = await apiClient.post<Sensor>('/sensors', payload);
    return response.data;
  },

  /**
   * Tra cứu bản ghi dữ liệu đo gần nhất của một cảm biến.
   * Trả về null nếu cảm biến mới tạo và chưa có dữ liệu đo.
   */
  async getLatestReading(sensorId: string): Promise<SensorReading | null> {
    try {
      const response = await apiClient.get<SensorReading>(
        `/sensors/${sensorId}/readings/latest`
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Tra cứu lịch sử dữ liệu đo theo khoảng thời gian (from - to) và sắp xếp tăng dần theo thời gian để vẽ biểu đồ.
   */
  async getReadingHistory(
    sensorId: string,
    params?: HistoryQueryParams
  ): Promise<SensorReading[]> {
    const response = await apiClient.get<SensorReading[]>(
      `/sensors/${sensorId}/readings`,
      { params }
    );
    // API trả về mới nhất trước (DESC) -> đảo chiều sang cũ -> mới (ASC) cho biểu đồ
    return [...response.data].reverse();
  },
};