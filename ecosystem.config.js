module.exports = {
  apps: [{
    name: "chiribot",
    script: "server.js",
    cwd: "/home/ubuntu/robot-ai",

    instances: "max",
    exec_mode: "cluster",

    max_memory_restart: "500M",

    env: {
      NODE_ENV: "production"
    },

    error_file: "/home/ubuntu/.pm2/logs/chiri-error.log",
    out_file: "/home/ubuntu/.pm2/logs/chiri-out.log",

    time: true
  }]
}
