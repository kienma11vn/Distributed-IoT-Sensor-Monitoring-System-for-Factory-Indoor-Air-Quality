using SensorApi.DTOs;

namespace SensorApi.Services;

public interface IRabbitMqPublisher
{
    /// <summary>
    /// Đẩy bản tin dữ liệu đo của cảm biến vào hàng đợi RabbitMQ.
    /// </summary>
    void PublishReading(ReadingMessageDto message);
}