using System.ComponentModel.DataAnnotations;

namespace SensorApi.DTOs;

public class CreateSensorDto
{
    [Required(ErrorMessage = "Tên cảm biến không được để trống.")]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Loại cảm biến không được để trống.")]
    [MaxLength(50)]
    public string SensorType { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vị trí lắp đặt không được để trống.")]
    [MaxLength(200)]
    public string Location { get; set; } = string.Empty;

    [Required(ErrorMessage = "Đơn vị đo không được để trống.")]
    [MaxLength(30)]
    public string Unit { get; set; } = string.Empty;

    [Required(ErrorMessage = "Ngưỡng cảnh báo không được để trống.")]
    public double Threshold { get; set; }
}