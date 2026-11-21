using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SensorApi.Data;
using SensorApi.DTOs;
using SensorApi.Models;
using SensorApi.Services;

namespace SensorApi.Controllers;

[ApiController]
[Route("sensors")]
public class SensorsController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly IRabbitMqPublisher _rabbitMqPublisher;
    private readonly ILogger<SensorsController> _logger;

    public SensorsController(
        AppDbContext dbContext,
        IRabbitMqPublisher rabbitMqPublisher,
        ILogger<SensorsController> logger)
    {
        _dbContext = dbContext;
        _rabbitMqPublisher = rabbitMqPublisher;
        _logger = logger;
    }

    /// <summary>
    /// Lấy danh sách toàn bộ cảm biến đã đăng ký trong hệ thống.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<Sensor>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<Sensor>>> GetAllSensors(CancellationToken cancellationToken)
    {
        var sensors = await _dbContext.Sensors
            .AsNoTracking()
            .OrderBy(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(sensors);
    }

    /// <summary>
    /// Lấy thông tin chi tiết một cảm biến theo ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(Sensor), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Sensor>> GetSensorById(Guid id, CancellationToken cancellationToken)
    {
        var sensor = await _dbContext.Sensors
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (sensor is null)
        {
            return NotFound(new { message = $"Không tìm thấy cảm biến với ID '{id}'." });
        }

        return Ok(sensor);
    }

    /// <summary>
    /// Đăng ký thông tin cảm biến mới kèm ngưỡng cảnh báo cấu hình.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(Sensor), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<Sensor>> CreateSensor(
        [FromBody] CreateSensorDto dto,
        CancellationToken cancellationToken)
    {
        var normalizedName = dto.Name.Trim();

        var exists = await _dbContext.Sensors
            .AnyAsync(s => s.Name == normalizedName, cancellationToken);

        if (exists)
        {
            return Conflict(new { message = $"Cảm biến '{normalizedName}' đã tồn tại trong hệ thống." });
        }

        var sensor = new Sensor
        {
            Id = Guid.NewGuid(),
            Name = normalizedName,
            SensorType = dto.SensorType.Trim().ToUpperInvariant(),
            Location = dto.Location.Trim(),
            Unit = dto.Unit.Trim(),
            Threshold = dto.Threshold,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Sensors.Add(sensor);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Đã đăng ký cảm biến mới: {SensorName} (ID={SensorId}, Ngưỡng={Threshold} {Unit})",
            sensor.Name, sensor.Id, sensor.Threshold, sensor.Unit);

        return CreatedAtAction(nameof(GetSensorById), new { id = sensor.Id }, sensor);
    }

    /// <summary>
    /// Tiếp nhận dữ liệu đo từ cảm biến giả lập và đẩy vào hàng đợi RabbitMQ để xử lý bất đồng bộ.
    /// </summary>
    [HttpPost("{id:guid}/readings")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> IngestReading(
        Guid id,
        [FromBody] ReadingRequestDto dto,
        CancellationToken cancellationToken)
    {
        var sensor = await _dbContext.Sensors
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (sensor is null)
        {
            return NotFound(new { message = $"Không tìm thấy cảm biến với ID '{id}'." });
        }

        var measuredAtUtc = dto.Timestamp.HasValue
            ? DateTime.SpecifyKind(dto.Timestamp.Value.ToUniversalTime(), DateTimeKind.Utc)
            : DateTime.UtcNow;

        var message = new ReadingMessageDto
        {
            SensorId = sensor.Id,
            SensorName = sensor.Name,
            SensorType = sensor.SensorType,
            Location = sensor.Location,
            Unit = sensor.Unit,
            Threshold = sensor.Threshold,
            Value = dto.Value,
            MeasuredAt = measuredAtUtc
        };

        _rabbitMqPublisher.PublishReading(message);

        return Accepted(new
        {
            status = "queued",
            sensorId = sensor.Id,
            value = dto.Value,
            measuredAt = measuredAtUtc
        });
    }

    /// <summary>
    /// Tra cứu bản ghi dữ liệu đo gần nhất của một cảm biến.
    /// </summary>
    [HttpGet("{id:guid}/readings/latest")]
    [ProducesResponseType(typeof(ReadingResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReadingResponseDto>> GetLatestReading(
        Guid id,
        CancellationToken cancellationToken)
    {
        var sensor = await _dbContext.Sensors
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (sensor is null)
        {
            return NotFound(new { message = $"Không tìm thấy cảm biến với ID '{id}'." });
        }

        var latestReading = await _dbContext.SensorReadings
            .AsNoTracking()
            .Where(r => r.SensorId == id)
            .OrderByDescending(r => r.MeasuredAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (latestReading is null)
        {
            return NotFound(new { message = $"Cảm biến '{sensor.Name}' chưa có dữ liệu đo nào." });
        }

        return Ok(MapToResponseDto(sensor, latestReading));
    }

    /// <summary>
    /// Tra cứu lịch sử dữ liệu đo của cảm biến theo khoảng thời gian (from - to).
    /// </summary>
    [HttpGet("{id:guid}/readings")]
    [ProducesResponseType(typeof(IEnumerable<ReadingResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IEnumerable<ReadingResponseDto>>> GetReadingHistory(
        Guid id,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int limit = 100,
        CancellationToken cancellationToken = default)
    {
        if (from.HasValue && to.HasValue && from.Value > to.Value)
        {
            return BadRequest(new { message = "Tham số 'from' không được lớn hơn 'to'." });
        }

        var sensor = await _dbContext.Sensors
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (sensor is null)
        {
            return NotFound(new { message = $"Không tìm thấy cảm biến với ID '{id}'." });
        }

        var safeLimit = Math.Clamp(limit, 1, 1000);

        var query = _dbContext.SensorReadings
            .AsNoTracking()
            .Where(r => r.SensorId == id);

        if (from.HasValue)
        {
            var fromUtc = DateTime.SpecifyKind(from.Value.ToUniversalTime(), DateTimeKind.Utc);
            query = query.Where(r => r.MeasuredAt >= fromUtc);
        }

        if (to.HasValue)
        {
            var toUtc = DateTime.SpecifyKind(to.Value.ToUniversalTime(), DateTimeKind.Utc);
            query = query.Where(r => r.MeasuredAt <= toUtc);
        }

        var readings = await query
            .OrderByDescending(r => r.MeasuredAt)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        var response = readings.Select(r => MapToResponseDto(sensor, r));
        return Ok(response);
    }

    private static ReadingResponseDto MapToResponseDto(Sensor sensor, SensorReading reading)
    {
        return new ReadingResponseDto
        {
            Id = reading.Id,
            SensorId = sensor.Id,
            SensorName = sensor.Name,
            SensorType = sensor.SensorType,
            Location = sensor.Location,
            Unit = sensor.Unit,
            Value = reading.Value,
            Threshold = reading.ThresholdSnapshot,
            IsAlert = reading.IsAlert,
            MeasuredAt = reading.MeasuredAt,
            ProcessedAt = reading.ProcessedAt
        };
    }
}