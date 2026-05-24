const oci = require('oci-sdk');
const { ObjectStorageClient } = require('oci-objectstorage');

class OracleAdapter {
    constructor() {
        this.provider = null;
        this.objectStorage = null;
        this.computeClient = null;
        this.namespace = null;
        this.init();
    }
    
    async init() {
        // Xác thực với Oracle Cloud
        this.provider = new oci.common.ConfigFileAuthenticationDetailsProvider(
            '~/.oci/config', 'DEFAULT'
        );
        
        this.objectStorage = new ObjectStorageClient({
            authenticationDetailsProvider: this.provider
        });
        
        // Get namespace
        const ns = await this.objectStorage.getNamespace({});
        this.namespace = ns.value;
        
        console.log('✅ Oracle Cloud adapter initialized');
    }
    
    async uploadVideo(frame, timestamp) {
        const objectName = `videos/frame_${timestamp}.jpg`;
        
        try {
            const response = await this.objectStorage.putObject({
                namespaceName: this.namespace,
                bucketName: process.env.ORACLE_BUCKET,
                objectName: objectName,
                putObjectBody: frame,
                contentType: 'image/jpeg'
            });
            
            return {
                url: `https://objectstorage.${process.env.ORACLE_REGION}.oraclecloud.com/n/${this.namespace}/b/${process.env.ORACLE_BUCKET}/o/${objectName}`,
                etag: response.etag
            };
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    }
    
    async saveSensorData(sensors) {
        // Lưu vào Object Storage dạng JSON
        const data = {
            timestamp: new Date().toISOString(),
            sensors: sensors,
            robotId: process.env.ROBOT_ID
        };
        
        const objectName = `sensors/sensor_${Date.now()}.json`;
        
        await this.objectStorage.putObject({
            namespaceName: this.namespace,
            bucketName: process.env.ORACLE_BUCKET,
            objectName: objectName,
            putObjectBody: JSON.stringify(data),
            contentType: 'application/json'
        });
        
        return { success: true, path: objectName };
    }
    
    async getRobotMetrics() {
        // Lấy metrics từ Compute Instance
        const computeClient = new oci.compute.ComputeClient({
            authenticationDetailsProvider: this.provider
        });
        
        const instance = await computeClient.getInstance({
            instanceId: process.env.ORACLE_COMPUTE_ID
        });
        
        return {
            cpu: instance['cpuCores'],
            memory: instance['memoryInGBs'],
            state: instance['lifecycleState']
        };
    }
}

module.exports = new OracleAdapter();
