using System.Text.Json;
using RabbitMQ.Client;
using SensorApi.DTOs;

namespace SensorApi.Services;

public sealed class RabbitMqPublisher : IRabbitMqPublisher, IDisposable
{
    private readonly ILogger<RabbitMqPublisher> _logger;
    private readonly ConnectionFactory _connectionFactory;
    private readonly string _exchangeName;
    private readonly string _routingKey;
    private readonly string _queueName;
    private readonly JsonSerializerOptions _jsonOptions;
    private readonly object _lock = new();

    private IConnection? _connection;
    private IModel? _channel;
    private bool _disposed;

    public RabbitMqPublisher(IConfiguration configuration, ILogger<RabbitMqPublisher> logger)
    {
        _logger = logger;

        var rabbitSection = configuration.GetSection("RabbitMq");

        _connectionFactory = new ConnectionFactory
        {
            HostName = rabbitSection["HostName"] ?? "localhost",
            Port = int.TryParse(rabbitSection["Port"], out var port) ? port : 5672,
            UserName = rabbitSection["UserName"] ?? "guest",
            Password = rabbitSection["Password"] ?? "guest",
            VirtualHost = rabbitSection["VirtualHost"] ?? "/",
            AutomaticRecoveryEnabled = true,
            NetworkRecoveryInterval = TimeSpan.FromSeconds(5)
        };

        _exchangeName = rabbitSection["ReadingsExchange"] ?? "iot.readings.exchange";
        _routingKey = rabbitSection["ReadingsRoutingKey"] ?? "sensor.reading";
        _queueName = rabbitSection["ReadingsQueue"] ?? "readings.queue";

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        // Thử khởi tạo kết nối ngay khi service khởi động (không làm sập app nếu RabbitMQ đang khởi động chậm)
        try
        {
            EnsureConnected();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Chưa thể kết nối ngay tới RabbitMQ tại {Host}:{Port}. Hệ thống sẽ tự kết nối lại khi nhận dữ liệu.",
                _connectionFactory.HostName,
                _connectionFactory.Port);
        }
    }

    public void PublishReading(ReadingMessageDto message)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        lock (_lock)
        {
            EnsureConnected();

            var body = JsonSerializer.SerializeToUtf8Bytes(message, _jsonOptions);

            var properties = _channel!.CreateBasicProperties();
            properties.Persistent = true; // Lưu tin nhắn xuống ổ đĩa RabbitMQ (DeliveryMode = 2)
            properties.ContentType = "application/json";
            properties.Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds());

            _channel.BasicPublish(
                exchange: _exchangeName,
                routingKey: _routingKey,
                basicProperties: properties,
                body: body);

            _logger.LogDebug(
                "Đã đẩy dữ liệu cảm biến [{SensorType}] {SensorName} (Value={Value}) vào queue '{Queue}'.",
                message.SensorType,
                message.SensorName,
                message.Value,
                _queueName);
        }
    }

    private void EnsureConnected()
    {
        if (_connection is { IsOpen: true } && _channel is { IsOpen: true })
        {
            return;
        }

        CleanupConnection();

        _connection = _connectionFactory.CreateConnection("sensor-api-publisher");
        _channel = _connection.CreateModel();

        // Khai báo Direct Exchange và Durable Queue đảm bảo không mất dữ liệu khi RabbitMQ restart
        _channel.ExchangeDeclare(
            exchange: _exchangeName,
            type: ExchangeType.Direct,
            durable: true,
            autoDelete: false);

        _channel.QueueDeclare(
            queue: _queueName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: null);

        _channel.QueueBind(
            queue: _queueName,
            exchange: _exchangeName,
            routingKey: _routingKey);

        _logger.LogInformation(
            "Đã kết nối RabbitMQ ({Host}:{Port}) và sẵn sàng đẩy tin vào queue '{Queue}'.",
            _connectionFactory.HostName,
            _connectionFactory.Port,
            _queueName);
    }

    private void CleanupConnection()
    {
        try
        {
            _channel?.Close();
            _channel?.Dispose();
        }
        catch
        {
            // Bỏ qua lỗi dọn dẹp channel cũ đã ngắt kết nối
        }
        finally
        {
            _channel = null;
        }

        try
        {
            _connection?.Close();
            _connection?.Dispose();
        }
        catch
        {
            // Bỏ qua lỗi dọn dẹp connection cũ đã ngắt kết nối
        }
        finally
        {
            _connection = null;
        }
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        lock (_lock)
        {
            CleanupConnection();
            _disposed = true;
        }
    }
}