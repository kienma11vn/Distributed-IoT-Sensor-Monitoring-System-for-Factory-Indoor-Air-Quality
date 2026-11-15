import asyncio
import logging
import random
import signal
from datetime import datetime, timezone
from typing import Any

import aiohttp

from config import (
    API_BASE_URL,
    FACTORY_SENSORS,
    SEND_INTERVAL_SECONDS,
    SPIKE_PROBABILITY,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("FactoryAirSimulator")

shutdown_event = asyncio.Event()


def handle_shutdown() -> None:
    logger.info("Nhận tín hiệu dừng. Đang đóng các luồng giả lập cảm biến...")
    shutdown_event.set()


async def wait_for_api(session: aiohttp.ClientSession, max_retries: int = 30) -> bool:
    """Chờ Sensor API sẵn sàng trước khi đăng ký cảm biến."""
    url = f"{API_BASE_URL}/sensors"
    for attempt in range(1, max_retries + 1):
        if shutdown_event.is_set():
            return False
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=3)) as resp:
                if resp.status in (200, 204):
                    logger.info("Kết nối thành công tới Sensor API tại %s", API_BASE_URL)
                    return True
        except Exception as exc:
            logger.warning(
                "Chưa kết nối được Sensor API (lần %d/%d): %s. Thử lại sau 2s...",
                attempt,
                max_retries,
                exc,
            )
        await asyncio.sleep(2)
    return False


async def register_or_sync_sensors(
    session: aiohttp.ClientSession,
) -> list[tuple[str | int, dict[str, Any]]]:
    """Lấy danh sách cảm biến hiện có hoặc đăng ký mới qua POST /sensors."""
    sensors_url = f"{API_BASE_URL}/sensors"
    existing_by_name: dict[str, Any] = {}

    async with session.get(sensors_url) as resp:
        resp.raise_for_status()
        data = await resp.json()
        if isinstance(data, list):
            for item in data:
                if "name" in item and "id" in item:
                    existing_by_name[item["name"]] = item["id"]

    active_sensors: list[tuple[str | int, dict[str, Any]]] = []

    for sensor_cfg in FACTORY_SENSORS:
        name = sensor_cfg["name"]
        if name in existing_by_name:
            sensor_id = existing_by_name[name]
            logger.info("Đã đồng bộ cảm biến có sẵn: [ID=%s] %s", sensor_id, name)
            active_sensors.append((sensor_id, sensor_cfg))
            continue

        payload = {
            "name": sensor_cfg["name"],
            "sensorType": sensor_cfg["sensorType"],
            "location": sensor_cfg["location"],
            "unit": sensor_cfg["unit"],
            "threshold": sensor_cfg["threshold"],
        }

        async with session.post(sensors_url, json=payload) as resp:
            resp.raise_for_status()
            created = await resp.json()
            sensor_id = created["id"]
            logger.info(
                "Đăng ký mới cảm biến: [ID=%s] %s (Ngưỡng: %s %s)",
                sensor_id,
                name,
                sensor_cfg["threshold"],
                sensor_cfg["unit"],
            )
            active_sensors.append((sensor_id, sensor_cfg))

    return active_sensors


class SensorState:
    """Lưu trạng thái giá trị trước đó để tạo biến thiên mượt và chuỗi sự cố thực tế."""

    def __init__(self, cfg: dict[str, Any]) -> None:
        self.cfg = cfg
        self.current_value = round(
            random.uniform(cfg["normal_min"], cfg["normal_max"]), 2
        )
        self.spike_remaining_ticks = 0

    def next_value(self) -> float:
        low = self.cfg["normal_min"]
        high = self.cfg["normal_max"]
        threshold = self.cfg["threshold"]
        spike_max = self.cfg["spike_max"]

        # Đang trong chuỗi sự cố rò rỉ khí/bụi
        if self.spike_remaining_ticks > 0:
            self.spike_remaining_ticks -= 1
            self.current_value = round(
                random.uniform(threshold * 1.05, spike_max), 2
            )
            return self.current_value

        # Kích hoạt sự cố vượt ngưỡng ngẫu nhiên (kéo dài 2-3 nhịp đo)
        if random.random() < SPIKE_PROBABILITY:
            self.spike_remaining_ticks = random.randint(1, 2)
            self.current_value = round(
                random.uniform(threshold * 1.05, spike_max), 2
            )
            return self.current_value

        # Dao động tự nhiên quanh giá trị trước đó trong dải an toàn
        span = high - low
        delta = random.uniform(-0.15 * span, 0.15 * span)
        next_val = max(low, min(high, self.current_value + delta))
        self.current_value = round(next_val, 2)
        return self.current_value


async def run_sensor_loop(
    session: aiohttp.ClientSession,
    sensor_id: str | int,
    sensor_cfg: dict[str, Any],
) -> None:
    """Vòng lặp gửi dữ liệu đo định kỳ cho một cảm biến cụ thể."""
    endpoint = f"{API_BASE_URL}/sensors/{sensor_id}/readings"
    state = SensorState(sensor_cfg)

    # Tạo độ trễ khởi đầu ngẫu nhiên (0 -> 2s) để tránh tất cả cảm biến bắn cùng 1 mili-giây
    await asyncio.sleep(random.uniform(0, 2.0))

    while not shutdown_event.is_set():
        value = state.next_value()
        timestamp = datetime.now(timezone.utc).isoformat()
        is_exceeded = value > sensor_cfg["threshold"]

        payload = {
            "value": value,
            "timestamp": timestamp,
        }

        try:
            async with session.post(
                endpoint, json=payload, timeout=aiohttp.ClientTimeout(total=5)
            ) as resp:
                if resp.status in (200, 201, 202):
                    status_tag = "VƯỢT NGƯỠNG!" if is_exceeded else "Bình thường"
                    log_fn = logger.warning if is_exceeded else logger.info
                    log_fn(
                        "[%s] %s -> %.2f %s (Ngưỡng: %.2f) | %s",
                        sensor_cfg["sensorType"],
                        sensor_cfg["location"],
                        value,
                        sensor_cfg["unit"],
                        sensor_cfg["threshold"],
                        status_tag,
                    )
                else:
                    body = await resp.text()
                    logger.error(
                        "Lỗi gửi dữ liệu cảm biến %s (HTTP %d): %s",
                        sensor_id,
                        resp.status,
                        body,
                    )
        except Exception as exc:
            logger.error("Mất kết nối khi gửi dữ liệu cảm biến %s: %s", sensor_id, exc)

        try:
            await asyncio.wait_for(
                shutdown_event.wait(), timeout=SEND_INTERVAL_SECONDS
            )
        except asyncio.TimeoutError:
            pass


async def main() -> None:
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, handle_shutdown)
        except NotImplementedError:
            # Windows không hỗ trợ add_signal_handler cho SIGTERM
            pass

    async with aiohttp.ClientSession() as session:
        is_ready = await wait_for_api(session)
        if not is_ready:
            logger.error("Không thể kết nối tới Sensor API. Thoát chương trình.")
            return

        active_sensors = await register_or_sync_sensors(session)
        if not active_sensors:
            logger.error("Không có cảm biến nào được kích hoạt.")
            return

        logger.info(
            "Bắt đầu giả lập %d cảm biến chất lượng không khí (chu kỳ %.1fs)...",
            len(active_sensors),
            SEND_INTERVAL_SECONDS,
        )

        tasks = [
            asyncio.create_task(run_sensor_loop(session, sensor_id, cfg))
            for sensor_id, cfg in active_sensors
        ]
        await asyncio.gather(*tasks)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Đã dừng trình giả lập.")