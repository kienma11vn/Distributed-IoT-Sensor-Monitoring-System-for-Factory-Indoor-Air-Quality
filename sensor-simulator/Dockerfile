FROM python:3.11-slim

# Đảm bảo log Python hiển thị ngay lập tức trong docker-compose logs
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY config.py simulator.py ./

CMD ["python", "simulator.py"]