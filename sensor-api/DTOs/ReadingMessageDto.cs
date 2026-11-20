namespace SensorApi.DTOs;

public class ReadingMessageDto
{
    public Guid SensorId { get; set; }
    public string SensorName { get; set; } = string.Empty;
    public string SensorType { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public double Threshold { get; set; }
    public double Value { get; set; }
    public DateTime MeasuredAt { get; set; }
}