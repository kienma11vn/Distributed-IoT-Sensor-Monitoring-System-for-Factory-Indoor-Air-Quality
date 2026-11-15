import os
from dotenv import load_dotenv

load_dotenv()

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:5000").rstrip("/")
SEND_INTERVAL_SECONDS = float(os.getenv("SEND_INTERVAL_SECONDS", "3.0"))
SPIKE_PROBABILITY = float(os.getenv("SPIKE_PROBABILITY", "0.12"))  # 12% xác suất xảy ra sự cố vượt ngưỡng

# Danh sách cảm biến chất lượng không khí trong nhà máy
FACTORY_SENSORS = [
    {
        "name": "Cảm biến bụi mịn PM2.5 - Xưởng Cắt",
        "sensorType": "PM25",
        "location": "Phân xưởng Cắt Kim Loại A1",
        "unit": "µg/m³",
        "normal_min": 18.0,
        "normal_max": 48.0,
        "threshold": 75.0,      # Ngưỡng cảnh báo: > 75 µg/m³
        "spike_max": 160.0,
    },
    {
        "name": "Cảm biến khí CO - Khu Lò Hàn",
        "sensorType": "CO",
        "location": "Phân xưởng Hàn & Gia Nhiệt B1",
        "unit": "ppm",
        "normal_min": 1.0,
        "normal_max": 9.5,
        "threshold": 25.0,      # Ngưỡng cảnh báo khí độc CO: > 25 ppm
        "spike_max": 65.0,
    },
    {
        "name": "Cảm biến hợp chất VOC - Xưởng Sơn",
        "sensorType": "VOC",
        "location": "Buồng Sơn Tĩnh Điện C2",
        "unit": "ppb",
        "normal_min": 60.0,
        "normal_max": 240.0,
        "threshold": 500.0,     # Ngưỡng cảnh báo hơi dung môi: > 500 ppb
        "spike_max": 1100.0,
    },
    {
        "name": "Cảm biến khí CO2 - Khu Đóng Gói",
        "sensorType": "CO2",
        "location": "Dây chuyền Đóng Gói D1",
        "unit": "ppm",
        "normal_min": 450.0,
        "normal_max": 850.0,
        "threshold": 1200.0,    # Ngưỡng cảnh báo ngột ngạt: > 1200 ppm
        "spike_max": 2200.0,
    },
    {
        "name": "Cảm biến bụi thô PM10 - Kho Nguyên Liệu",
        "sensorType": "PM10",
        "location": "Kho Vật Tư Tổng Hợp E1",
        "unit": "µg/m³",
        "normal_min": 30.0,
        "normal_max": 85.0,
        "threshold": 150.0,     # Ngưỡng cảnh báo bụi kho: > 150 µg/m³
        "spike_max": 320.0,
    },
]