# Giai đoạn 1: Build ứng dụng với .NET 8 SDK
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Sao chép file .csproj và khôi phục thư viện trước để tận dụng Docker layer cache
COPY SensorApi.csproj ./
RUN dotnet restore SensorApi.csproj

# Sao chép toàn bộ mã nguồn và biên dịch bản Release
COPY . ./
RUN dotnet publish SensorApi.csproj -c Release -o /app/publish /p:UseAppHost=false

# Giai đoạn 2: Chạy ứng dụng trên ASP.NET Core Runtime gọn nhẹ
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_RUNNING_IN_CONTAINER=true

EXPOSE 8080

COPY --from=build /app/publish ./

ENTRYPOINT ["dotnet", "SensorApi.dll"]