
// Face Detection using MediaPipe
class FaceDetector {
    constructor() {
        this.faceDetection = null;
        this.camera = null;
        this.video = null;
        self.canvas = null;
        this.isRunning = false;
        this.onFaceDetected = null;
        this.lastDetection = null;
    }

    async initialize(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        
        // Initialize MediaPipe Face Detection
        this.faceDetection = new FaceDetection({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
            }
        });
        
        this.faceDetection.setOptions({
            model: 'short',
            minDetectionConfidence: 0.5
        });
        
        this.faceDetection.onResults((results) => this.onResults(results));
        
        // Start camera
        this.camera = new Camera(this.video, {
            onFrame: async () => {
                if (this.isRunning) {
                    await this.faceDetection.send({ image: this.video });
                }
            },
            width: 640,
            height: 480
        });
        
        await this.camera.start();
        this.isRunning = true;
        
        return true;
    }
    
    onResults(results) {
        // Clear canvas
        const canvasCtx = this.canvas.getContext('2d');
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        canvasCtx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);
        
        if (results.detections.length > 0) {
            for (const detection of results.detections) {
                // Draw bounding box
                this.drawBoundingBox(detection);
                
                // Analyze face for glasses and hat
                const analysis = this.analyzeFaceFeatures(detection);
                
                // Update UI with analysis
                if (this.onFaceDetected) {
                    this.onFaceDetected(analysis, detection);
                }
            }
        } else {
            if (this.onFaceDetected) {
                this.onFaceDetected({ hasFace: false }, null);
            }
        }
        
        canvasCtx.restore();
    }
    
    drawBoundingBox(detection) {
        const canvasCtx = this.canvas.getContext('2d');
        const boundingBox = detection.boundingBox;
        
        // Draw rectangle
        canvasCtx.strokeStyle = '#00ff00';
        canvasCtx.lineWidth = 3;
        canvasCtx.strokeRect(
            boundingBox.xMin, boundingBox.yMin,
            boundingBox.xMax - boundingBox.xMin,
            boundingBox.yMax - boundingBox.yMin
        );
        
        // Draw key points
        if (detection.landmarks) {
            for (const landmark of detection.landmarks) {
                canvasCtx.fillStyle = '#ff0000';
                canvasCtx.beginPath();
                canvasCtx.arc(landmark.x, landmark.y, 3, 0, 2 * Math.PI);
                canvasCtx.fill();
            }
        }
    }
    
    analyzeFaceFeatures(detection) {
        const analysis = {
            hasFace: true,
            hasGlasses: false,
            hasHat: false,
            confidence: detection.score[0] || 0,
            facePosition: {
                x: (detection.boundingBox.xMin + detection.boundingBox.xMax) / 2,
                y: (detection.boundingBox.yMin + detection.boundingBox.yMax) / 2
            },
            faceSize: {
                width: detection.boundingBox.xMax - detection.boundingBox.xMin,
                height: detection.boundingBox.yMax - detection.boundingBox.yMin
            }
        };
        
        // Detect glasses based on eye region analysis
        if (detection.landmarks && detection.landmarks.length > 0) {
            // Get eye landmarks (approximate positions)
            const leftEye = detection.landmarks.find(l => l.x < detection.boundingBox.xMin + (detection.boundingBox.xMax - detection.boundingBox.xMin) * 0.4);
            const rightEye = detection.landmarks.find(l => l.x > detection.boundingBox.xMin + (detection.boundingBox.xMax - detection.boundingBox.xMin) * 0.6);
            
            if (leftEye && rightEye) {
                // Check for glasses by analyzing brightness/contrast around eyes
                // This is a simplified detection - for better accuracy, use a dedicated model
                const eyeDistance = Math.abs(leftEye.x - rightEye.x);
                const faceWidth = analysis.faceSize.width;
                
                // Glasses typically have distinct reflections
                // For demo purposes, we'll use a combination of factors
                analysis.hasGlasses = this.simulateGlassesDetection(detection);
            }
        }
        
        // Detect hat based on position above face
        // Hat typically appears above the face bounding box
        analysis.hasHat = this.simulateHatDetection(detection);
        
        return analysis;
    }
    
    simulateGlassesDetection(detection) {
        // In a real implementation, you would use:
        // 1. A dedicated glasses detection model
        // 2. Or analyze the eye region for lens reflections
        // 3. Or use the presence of distinct light patterns
        
        // For demonstration, we'll use a combination of face size and position
        // This is a SIMULATION - replace with actual ML model
        const faceWidth = detection.boundingBox.xMax - detection.boundingBox.xMin;
        const faceHeight = detection.boundingBox.yMax - detection.boundingBox.yMin;
        
        // Glasses often appear when face is well-lit and centered
        // Random detection for demo - replace with actual model
        // In production, use MediaPipe Face Mesh or TensorFlow.js
        return false; // Default to false, enable actual detection below
        
        // UNCOMMENT for actual detection using pixel analysis:
        /*
        const canvas = this.canvas;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(
            detection.boundingBox.xMin, 
            detection.boundingBox.yMin + faceHeight * 0.4,
            faceWidth,
            faceHeight * 0.2
        );
        
        // Analyze pixel brightness around eyes
        let avgBrightness = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
            const brightness = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
            avgBrightness += brightness;
        }
        avgBrightness /= (imageData.data.length / 4);
        
        // Glasses often cause reflection patterns
        return avgBrightness > 150;
        */
    }
    
    simulateHatDetection(detection) {
        // In production, use a dedicated headwear detection model
        // For demonstration, we'll check the area above the face
        
        const faceY = detection.boundingBox.yMin;
        const faceHeight = detection.boundingBox.yMax - detection.boundingBox.yMin;
        
        // Check if there's additional content above the face
        // This is a SIMULATION - replace with actual detection
        // For demo purposes, we'll randomly detect hat 30% of the time
        // In production, use MediaPipe's holistic model
        
        return false; // Default to false
        
        // UNCOMMENT for actual detection:
        /*
        const canvas = this.canvas;
        const ctx = canvas.getContext('2d');
        
        // Check area above face (potential hat region)
        const hatRegion = ctx.getImageData(
            detection.boundingBox.xMin,
            Math.max(0, faceY - faceHeight * 0.5),
            detection.boundingBox.xMax - detection.boundingBox.xMin,
            faceHeight * 0.5
        );
        
        // Analyze for distinctive hat features (edges, colors)
        let edgeCount = 0;
        for (let i = 0; i < hatRegion.data.length; i += 4) {
            const r = hatRegion.data[i];
            const g = hatRegion.data[i+1];
            const b = hatRegion.data[i+2];
            
            // Look for sharp color transitions (hat rims)
            if (Math.abs(r - g) > 50 || Math.abs(g - b) > 50 || Math.abs(r - b) > 50) {
                edgeCount++;
            }
        }
        
        return edgeCount > hatRegion.data.length / 100;
        */
    }
    
    stop() {
        this.isRunning = false;
        if (this.camera) {
            this.camera.stop();
        }
    }
}

// Export for use in main script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FaceDetector;
}
