import React, { useState, useEffect } from 'react';
import { cloudAPI } from '../services/cloudAPI';

function CloudDashboard() {
    const [metrics, setMetrics] = useState({});
    const [currentCloud, setCurrentCloud] = useState('');
    
    useEffect(() => {
        const fetchMetrics = async () => {
            const data = await cloudAPI.getMetrics();
            setMetrics(data);
            setCurrentCloud(data.current);
        };
        
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 10000);
        return () => clearInterval(interval);
    }, []);
    
    const getCloudStatus = (cloudName) => {
        const cloud = metrics[cloudName];
        if (!cloud) return 'unknown';
        return cloud.available ? 'available' : 'unavailable';
    };
    
    return (
        <div className="cloud-dashboard">
            <h2>🌩️ Multi-Cloud Dashboard</h2>
            
            <div className="current-cloud">
                <h3>Active Cloud: 
                    <span className={`cloud-${currentCloud}`}>
                        {currentCloud?.toUpperCase()}
                    </span>
                </h3>
            </div>
            
            <div className="cloud-grid">
                <div className={`cloud-card ${getCloudStatus('railway')}`}>
                    <h3>🚂 Railway</h3>
                    <p>Connections: {metrics.railway?.connections || 0}</p>
                    <p>Redis: {metrics.railway?.redisConnected ? '✅' : '❌'}</p>
                </div>
                
                <div className={`cloud-card ${getCloudStatus('oracle')}`}>
                    <h3>☁️ Oracle Cloud</h3>
                    <p>Storage: {metrics.oracle?.bucketName || 'N/A'}</p>
                    <p>CPU: {metrics.oracle?.cpu || 'N/A'} cores</p>
                </div>
                
                <div className={`cloud-card ${getCloudStatus('ngrok')}`}>
                    <h3>🔗 ngrok</h3>
                    <p>Tunnels: {metrics.ngrok?.tunnels?.length || 0}</p>
                    <p>URL: {metrics.ngrok?.url || 'N/A'}</p>
                </div>
            </div>
            
            <button onClick={() => cloudAPI.switchCloud('railway')}>
                Switch to Railway
            </button>
            <button onClick={() => cloudAPI.switchCloud('oracle')}>
                Switch to Oracle
            </button>
        </div>
    );
}
