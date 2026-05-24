import api from './api';

// Chỉ gọi API, KHÔNG chứa logic xử lý robot
export const robotAPI = {
    sendCommand: async (command, speed = 150) => {
        const response = await api.post('/robot/control', { command, speed });
        return response.data;
    },
    
    getSensors: async () => {
        const response = await api.get('/robot/sensors');
        return response.data;
    },
    
    getStatus: async () => {
        const response = await api.get('/robot/status');
        return response.data;
    }
};
