using Microsoft.EntityFrameworkCore;
using SensorApi.Data;
using SensorApi.Services;

var builder = WebApplication.CreateBuilder(args);

// Đăng ký kết nối PostgreSQL qua Entity Framework Core
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Chưa cấu hình ConnectionStrings:DefaultConnection.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// Đăng ký RabbitMQ Publisher dạng Singleton để duy trì kết nối bền vững tới Broker
builder.Services.AddSingleton<IRabbitMqPublisher, RabbitMqPublisher>();

// Cấu hình Controllers và chuẩn hóa JSON camelCase
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// Cấu hình Swagger/OpenAPI phục vụ kiểm thử và demo API
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "IoT Factory Air Quality - Sensor API",
        Version = "v1",
        Description = "API tiếp nhận dữ liệu cảm biến chất lượng không khí và truy vấn lịch sử đo."
    });
});

// Cấu hình CORS cho Dashboard Client (React)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowDashboard", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Bật Swagger trên mọi môi trường (bao gồm Docker) để thuận tiện kiểm thử khi báo cáo
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Sensor API v1");
    options.RoutePrefix = "swagger";
});

app.UseCors("AllowDashboard");
app.UseAuthorization();

// Endpoint kiểm tra trạng thái sống của service (Healthcheck cho Docker Compose)
app.MapGet("/health", () => Results.Ok(new
{
    service = "sensor-api",
    status = "healthy",
    timestamp = DateTime.UtcNow
}));

app.MapControllers();

app.Run();