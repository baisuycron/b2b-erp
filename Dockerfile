FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html mall.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM maven:3.9.9-eclipse-temurin-21 AS backend-builder
WORKDIR /app/backend
COPY backend/pom.xml ./
COPY backend/src ./src
RUN mvn -DskipTests package

FROM eclipse-temurin:21-jre AS backend-runtime
WORKDIR /app/backend
COPY --from=backend-builder /app/backend/target/b2b-api-0.1.0-SNAPSHOT.jar ./target/b2b-api-0.1.0-SNAPSHOT.jar
ENV SERVER_PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "target/b2b-api-0.1.0-SNAPSHOT.jar"]

FROM nginx:1.27-alpine AS frontend-runtime
COPY nginx.docker.conf.example /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/dist-web /usr/share/nginx/html
EXPOSE 80
