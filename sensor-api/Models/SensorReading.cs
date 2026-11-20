using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace SensorApi.Models;

[Table("sensor_readings")]
public class SensorReading
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public long Id { get; set; }

    [Required]
    [Column("sensor_id")]
    public Guid SensorId { get; set; }

    [Column("value")]
    public double Value { get; set; }

    [Column("threshold_snapshot")]
    public double ThresholdSnapshot { get; set; }

    [Column("is_alert")]
    public bool IsAlert { get; set; }

    [Column("measured_at")]
    public DateTime MeasuredAt { get; set; }

    [Column("processed_at")]
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;

    [JsonIgnore]
    [ForeignKey(nameof(SensorId))]
    public Sensor? Sensor { get; set; }
}