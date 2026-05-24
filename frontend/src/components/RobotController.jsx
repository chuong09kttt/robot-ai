import React, { useState, useEffect } from 'react';
import { robotAPI } from '../services/robotAPI';

function RobotController() {
    const [sensors, setSensors] = useState({ distance: 0, battery: 0 });
    const [isLoading, setIsLoading] = useState(false);
    
    useEffect(() => {
        // Poll sensor data every 500ms
        const interval = setInterval(async () => {
            try {
                const data = await robotAPI.getSensors();
                setSensors(data);
            } catch (error) {
                console.error('Failed to get sensors:', error);
            }
        }, 500);
        
        return () => clearInterval(interval);
    }, []);
    
    const handleCommand = async (command) => {
        setIsLoading(true);
        try {
            await robotAPI.sendCommand(command, 150);
            console.log(`Command ${command} sent successfully`);
        } catch (error) {
            alert('Failed to send command');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="controller">
            <div className="sensors">
                <p>📡 Distance: {sensors.distance}cm</p>
                <p>🔋 Battery: {sensors.battery}%</p>
                <p>🌡️ Temperature: {sensors.temperature}°C</p>
            </div>
            
            <div className="buttons">
                <button onClick={() => handleCommand('FORWARD')} disabled={isLoading}>
                    ⬆️ Forward
                </button>
                <button onClick={() => handleCommand('LEFT')} disabled={isLoading}>
                    ⬅️ Left
                </button>
                <button onClick={() => handleCommand('STOP')} disabled={isLoading}>
                    ⏹️ Stop
                </button>
                <button onClick={() => handleCommand('RIGHT')} disabled={isLoading}>
                    ➡️ Right
                </button>
                <button onClick={() => handleCommand('BACKWARD')} disabled={isLoading}>
                    ⬇️ Backward
                </button>
            </div>
        </div>
    );
}

export default RobotController;
