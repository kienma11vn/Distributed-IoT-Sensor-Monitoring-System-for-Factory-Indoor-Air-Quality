using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace SensorApi.Models;

[Table("sensors")]
public class Sensor
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(150)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    [Column("sensor_type")]
    public string SensorType { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    [Column("location")]
    public string Location { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    [Column("unit")]
    public string Unit { get; set; } = string.Empty;

    [Column("threshold")]
    public double Threshold { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [JsonIgnore]
    public ICollection<SensorReading> Readings { get; set; } = new List<SensorReading>();
}