using Microsoft.EntityFrameworkCore;
using SensorApi.Models;

namespace SensorApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Sensor> Sensors => Set<Sensor>();
    public DbSet<SensorReading> SensorReadings => Set<SensorReading>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Cấu hình thực thể Sensor khớp với bảng sensors trong PostgreSQL
        modelBuilder.Entity<Sensor>(entity =>
        {
            entity.ToTable("sensors");

            entity.HasKey(s => s.Id);

            entity.Property(s => s.Id)
                .HasDefaultValueSql("gen_random_uuid()");

            entity.HasIndex(s => s.Name)
                .IsUnique();

            entity.Property(s => s.CreatedAt)
                .HasDefaultValueSql("NOW()");
        });

        // Cấu hình thực thể SensorReading khớp với bảng sensor_readings trong PostgreSQL
        modelBuilder.Entity<SensorReading>(entity =>
        {
            entity.ToTable("sensor_readings");

            entity.HasKey(r => r.Id);

            entity.Property(r => r.IsAlert)
                .HasDefaultValue(false);

            entity.Property(r => r.ProcessedAt)
                .HasDefaultValueSql("NOW()");

            // Thiết lập quan hệ 1-N với Sensor (xóa cảm biến sẽ xóa lịch sử đo liên quan)
            entity.HasOne(r => r.Sensor)
                .WithMany(s => s.Readings)
                .HasForeignKey(r => r.SensorId)
                .OnDelete(DeleteBehavior.Cascade);

            // Chỉ mục tối ưu truy vấn /readings/latest và lọc lịch sử theo khoảng thời gian
            entity.HasIndex(r => new { r.SensorId, r.MeasuredAt })
                .HasDatabaseName("idx_sensor_readings_sensor_measured")
                .IsDescending(false, true);

            // Chỉ mục riêng cho các bản ghi vượt ngưỡng cảnh báo
            entity.HasIndex(r => new { r.IsAlert, r.MeasuredAt })
                .HasDatabaseName("idx_sensor_readings_alerts")
                .HasFilter("is_alert = TRUE")
                .IsDescending(false, true);
        });
    }
}