module.exports = {
  apps: [
    {
      name: 'agrios-backend',
      cwd: '/home/ubuntu/agrios-server/apps/backend',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      restart_delay: 5000,
      kill_timeout: 10000,
      listen_timeout: 10000,
      time: true,
      merge_logs: true,
      out_file: '/home/ubuntu/.pm2/logs/agrios-backend-out.log',
      error_file: '/home/ubuntu/.pm2/logs/agrios-backend-error.log',
      env: {
        NODE_ENV: 'production',
        PORT: '3100'
      }
    }
  ]
};
