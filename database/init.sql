-- Kích hoạt extension tạo UUID ngẫu nhiên (hỗ trợ sẵn từ PostgreSQL 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Bảng lưu thông tin cấu hình cảm biến
CREATE TABLE IF NOT EXISTS sensors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL UNIQUE,
    sensor_type VARCHAR(50) NOT NULL,       -- PM25, CO, VOC, CO2, PM10
    location VARCHAR(200) NOT NULL,         -- Vị trí phân xưởng trong nhà máy
    unit VARCHAR(30) NOT NULL,              -- µg/m³, ppm, ppb
    threshold DOUBLE PRECISION NOT NULL,    -- Ngưỡng cảnh báo cấu hình
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng lưu lịch sử dữ liệu đo và trạng thái cảnh báo
CREATE TABLE IF NOT EXISTS sensor_readings (
    id BIGSERIAL PRIMARY KEY,
    sensor_id UUID NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    value DOUBLE PRECISION NOT NULL,                -- Giá trị đo thực tế
    threshold_snapshot DOUBLE PRECISION NOT NULL,   -- Ngưỡng cảnh báo tại thời điểm đo
    is_alert BOOLEAN NOT NULL DEFAULT FALSE,        -- Trạng thái vượt ngưỡng (TRUE = Cảnh báo)
    measured_at TIMESTAMPTZ NOT NULL,               -- Thời điểm cảm biến ghi nhận dữ liệu
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Thời điểm Monitor Worker xử lý xong
);

-- Chỉ mục tối ưu truy vấn bản ghi mới nhất (/latest) và lọc lịch sử theo khoảng thời gian
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_measured
    ON sensor_readings (sensor_id, measured_at DESC);

-- Chỉ mục riêng cho các bản ghi vượt ngưỡng để thống kê cảnh báo nhanh
CREATE INDEX IF NOT EXISTS idx_sensor_readings_alerts
    ON sensor_readings (is_alert, measured_at DESC)
    WHERE is_alert = TRUE;

-- Dữ liệu mẫu 5 cảm biến giám sát chất lượng không khí nhà máy (Khớp với danh sách trong sensor-simulator/config.py để đồng bộ tự động)
INSERT INTO sensors (name, sensor_type, location, unit, threshold)
VALUES
    ('Cảm biến bụi mịn PM2.5 - Xưởng Cắt', 'PM25', 'Phân xưởng Cắt Kim Loại A1', 'µg/m³', 75.0),
    ('Cảm biến khí CO - Khu Lò Hàn', 'CO', 'Phân xưởng Hàn & Gia Nhiệt B1', 'ppm', 25.0),
    ('Cảm biến hợp chất VOC - Xưởng Sơn', 'VOC', 'Buồng Sơn Tĩnh Điện C2', 'ppb', 500.0),
    ('Cảm biến khí CO2 - Khu Đóng Gói', 'CO2', 'Dây chuyền Đóng Gói D1', 'ppm', 1200.0),
    ('Cảm biến bụi thô PM10 - Kho Nguyên Liệu', 'PM10', 'Kho Vật Tư Tổng Hợp E1', 'µg/m³', 150.0)
ON CONFLICT (name) DO NOTHING;