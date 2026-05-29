/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: "chatbot-bot",
      cwd: "./bot",
      script: "dist/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/bot-error.log",
      out_file: "./logs/bot-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
