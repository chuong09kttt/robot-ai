function detectEnvironment() {
    const railway = !!process.env.RAILWAY_ENVIRONMENT;

    const isSSH = !!process.env.SSH_CONNECTION;
    const isPM2 = !!process.env.PM2_HOME;
    const isUbuntu = process.env.HOME && process.env.HOME.includes('/home');

    const vps = isSSH || isPM2 || isUbuntu;

    if (railway) {
        return {
            name: 'railway',
            isRailway: true,
            isVPS: false,
            isLocal: false
        };
    }

    if (vps) {
        return {
            name: 'vps',
            isRailway: false,
            isVPS: true,
            isLocal: false
        };
    }

    return {
        name: 'local',
        isRailway: false,
        isVPS: false,
        isLocal: true
    };
}

module.exports = detectEnvironment();
