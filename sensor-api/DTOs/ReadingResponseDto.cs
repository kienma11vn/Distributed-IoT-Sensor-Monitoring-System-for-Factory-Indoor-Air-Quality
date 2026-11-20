namespace SensorApi.DTOs;

public class ReadingResponseDto
{
    public long Id { get; set; }
    public Guid SensorId { get; set; }
    public string SensorName { get; set; } = string.Empty;
    public string SensorType { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public double Value { get; set; }
    public double Threshold { get; set; }
    public bool IsAlert { get; set; }
    public DateTime MeasuredAt { get; set; }
    public DateTime ProcessedAt { get; set; }
}