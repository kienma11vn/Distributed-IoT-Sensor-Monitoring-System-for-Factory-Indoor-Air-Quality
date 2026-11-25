# Giai đoạn 1: Biên dịch ứng dụng bằng Maven và JDK 21
FROM maven:3.9.9-eclipse-temurin-21-alpine AS build
WORKDIR /app

# Tải trước các thư viện trong pom.xml để tận dụng Docker layer cache
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Sao chép mã nguồn và đóng gói file JAR
COPY src ./src
RUN mvn clean package -DskipTests -B

# Giai đoạn 2: Chạy ứng dụng trên JRE 21 Alpine tối giản
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Cài đặt curl phục vụ healthcheck trong Docker Compose
RUN apk add --no-cache curl

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]