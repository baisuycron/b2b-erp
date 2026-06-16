const backendDir = "./backend";

module.exports = {
  apps: [
    {
      name: "b2b-api",
      cwd: backendDir,
      script: "java",
      args: ["-jar", "target/b2b-api-0.1.0-SNAPSHOT.jar"],
      interpreter: "none",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        SERVER_PORT: process.env.SERVER_PORT || "8080",
        DB_URL: process.env.DB_URL || "jdbc:mysql://127.0.0.1:3306/b2b_erp?useUnicode=true&characterEncoding=UTF-8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=Asia/Shanghai",
        DB_USERNAME: process.env.DB_USERNAME || "b2b_erp",
        DB_PASSWORD: process.env.DB_PASSWORD || "change_me",
        JAVA_OPTS: process.env.JAVA_OPTS || "-Xms512m -Xmx1024m"
      }
    }
  ]
};
