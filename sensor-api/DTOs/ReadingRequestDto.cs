using System.ComponentModel.DataAnnotations;

namespace SensorApi.DTOs;

public class ReadingRequestDto
{
    [Required(ErrorMessage = "Giá trị đo không được để trống.")]
    public double Value { get; set; }

    /// <summary>
    /// Thời điểm đo theo chuẩn UTC ISO-8601. Nếu client không gửi, hệ thống lấy thời gian hiện tại.
    /// </summary>
    public DateTime? Timestamp { get; set; }
}