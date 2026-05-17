// ========== CAMERA MODULE ==========
// This file will be obfuscated

(function() {
    let camera = null;
    let faceMesh = null;
    let isActive = false;
    let isRecognizing = false;
    
    window.initCameraUI = async function() {
        console.log('📷 Camera mode initialized');
        
        const video = document.getElementById('video');
        const canvas = document.getElementById('canvas');
        
        if (!video || !canvas) return;
        if (typeof FaceMesh === 'undefined') {
            console.error('FaceMesh not loaded');
            return;
        }
        
        faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        
        faceMesh.setOptions({ maxNumFaces: 4, refineLandmarks: true });
        faceMesh.onResults(onResults);
        
        document.getElementById('cameraToggleBtn').onclick = toggleCamera;
        document.getElementById('registerFaceBtn').onclick = openRegisterModal;
        document.getElementById('recognizeFaceBtn').onclick = () => {
            isRecognizing = !isRecognizing;
            window.addMessage('ai', isRecognizing ? 'Bắt đầu nhận diện' : 'Đã tắt nhận diện');
            window.speak(isRecognizing ? 'Bắt đầu nhận diện khuôn mặt' : 'Đã tắt nhận diện');
        };
    };
    
    async function toggleCamera() {
        if (!isActive) {
            await startCamera();
        } else {
            stopCamera();
        }
    }
    
    async function startCamera() {
        if (typeof Camera === 'undefined') return;
        
        camera = new Camera(video, {
            onFrame: async () => {
                if (isActive && faceMesh) await faceMesh.send({ image: video });
            }
        });
        await camera.start();
        isActive = true;
        document.getElementById('cameraToggleBtn').textContent = 'TẮT CAMERA';
        document.getElementById('cameraStatusText').innerHTML = 'ACTIVE';
    }
    
    function stopCamera() {
        if (camera) camera.stop();
        isActive = false;
        document.getElementById('cameraToggleBtn').textContent = 'BẬT CAMERA';
        document.getElementById('cameraStatusText').innerHTML = 'OFFLINE';
    }
    
    function onResults(results) {
        if (!isActive) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        
        if (results.multiFaceLandmarks?.length > 0) {
            document.getElementById('faceText').textContent = `${results.multiFaceLandmarks.length} face(s) detected`;
            document.getElementById('faceEmoji').textContent = '😊';
            
            if (isRecognizing) {
                drawLandmarks(ctx, results.multiFaceLandmarks);
            }
        } else {
            document.getElementById('faceText').textContent = 'No face detected';
            document.getElementById('faceEmoji').textContent = '😔';
        }
    }
    
    function drawLandmarks(ctx, landmarks) {
        const colors = ['#00ff00', '#ff00ff', '#00ffff'];
        landmarks.forEach((lm, idx) => {
            ctx.fillStyle = colors[idx % colors.length];
            for (let i = 0; i < lm.length; i += 10) {
                const x = lm[i].x * canvas.width;
                const y = lm[i].y * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }
    
    let photoCount = 0;
    function openRegisterModal() {
        photoCount = 0;
        document.getElementById('photoCount').innerHTML = '📸 0/3 CAPTURED';
        document.getElementById('registerModal').style.display = 'flex';
        startRegisterCamera();
    }
    
    function closeRegisterModal() {
        document.getElementById('registerModal').style.display = 'none';
        if (window.registerStream) {
            window.registerStream.getTracks().forEach(t => t.stop());
            window.registerStream = null;
        }
    }
    
    async function startRegisterCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        window.registerStream = stream;
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        
        const preview = document.getElementById('previewCanvas');
        const ctx = preview.getContext('2d');
        
        function processFrame() {
            if (video.videoWidth > 0) {
                preview.width = video.videoWidth;
                preview.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, preview.width, preview.height);
                
                // Draw guide frame
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 3;
                ctx.strokeRect(
                    preview.width * 0.15, preview.height * 0.15,
                    preview.width * 0.7, preview.height * 0.7
                );
            }
            requestAnimationFrame(processFrame);
        }
        processFrame();
    }
    
    window.capturePhoto = function() {
        if (photoCount < 3) {
            photoCount++;
            document.getElementById('photoCount').innerHTML = `📸 ${photoCount}/3 CAPTURED`;
            
            // Flash effect
            const preview = document.getElementById('previewCanvas');
            const ctx = preview.getContext('2d');
            ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.fillRect(0, 0, preview.width, preview.height);
            setTimeout(() => ctx.clearRect(0, 0, preview.width, preview.height), 200);
        } else {
            alert('Đã chụp đủ 3 ảnh!');
        }
    };
    
    window.saveFaceRegistration = function() {
        const name = document.getElementById('faceNameInput').value.trim();
        if (!name) {
            alert('❌ Vui lòng nhập tên!');
            return;
        }
        if (photoCount < 3) {
            alert(`❌ Cần chụp đủ 3 ảnh! Hiện có ${photoCount}/3`);
            return;
        }
        alert(`✅ Đã đăng ký khuôn mặt cho ${name}!`);
        closeRegisterModal();
        document.getElementById('faceNameInput').value = '';
        photoCount = 0;
    };
    
    window.closeRegisterModal = closeRegisterModal;
})();
