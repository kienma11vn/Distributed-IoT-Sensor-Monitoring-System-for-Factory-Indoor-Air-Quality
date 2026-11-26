# Giai đoạn 1: Build ứng dụng React + TypeScript bằng Vite
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . ./

# Nhận địa chỉ API và SignalR lúc build image (hoặc dùng giá trị mặc định)
ARG VITE_API_BASE_URL=http://localhost:5000
ARG VITE_NOTIFICATION_URL=http://localhost:5001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_NOTIFICATION_URL=$VITE_NOTIFICATION_URL

RUN npm run build

# Giai đoạn 2: Phục vụ file tĩnh qua Nginx
FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html

# Cấu hình Nginx hỗ trợ SPA routing
RUN printf 'server {\n\
    listen 80;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]