function detect() {
    const railway = !!process.env.RAILWAY_ENVIRONMENT;
    const pm2 = !!process.env.PM2_HOME;
    const ssh = !!process.env.SSH_CONNECTION;
    const ubuntu = process.env.HOME?.includes('/home');

    if (railway) return 'railway';
    if (pm2 || ssh || ubuntu) return 'vps';
    return 'local';
}

const ENV_NAME = detect();

const ENV = {
    name: ENV_NAME,
    isRailway: ENV_NAME === 'railway',
    isVPS: ENV_NAME === 'vps',
    isLocal: ENV_NAME === 'local'
};

module.exports = ENV;
