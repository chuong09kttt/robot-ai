class RobotFace {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.expression = 'idle'; // idle, happy, sad, surprised, sleepy
        this.blink = false;
        this.init();
    }

    init() {
        setInterval(() => {
            this.blink = !this.blink;
            this.draw();
        }, 3000);
    }

    setExpression(expr) {
        this.expression = expr;
        this.draw();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        // Vẽ mặt nền
        this.ctx.fillStyle = '#FFE0B5';
        this.ctx.beginPath();
        this.ctx.arc(this.width/2, this.height/2, 140, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#C68B5E';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // Mắt
        const eyeX = [this.width/2 - 50, this.width/2 + 50];
        const eyeY = this.height/2 - 30;
        eyeX.forEach(x => {
            this.ctx.fillStyle = '#2C2C2C';
            this.ctx.beginPath();
            this.ctx.arc(x, eyeY, 18, 0, Math.PI*2);
            this.ctx.fill();
            if (this.blink) {
                this.ctx.fillStyle = '#FFE0B5';
                this.ctx.beginPath();
                this.ctx.arc(x, eyeY, 18, 0, Math.PI*2);
                this.ctx.fill();
            } else {
                this.ctx.fillStyle = 'white';
                this.ctx.beginPath();
                this.ctx.arc(x-5, eyeY-5, 5, 0, Math.PI*2);
                this.ctx.fill();
            }
        });

        // Lông mày (biểu cảm)
        this.ctx.beginPath();
        this.ctx.lineWidth = 8;
        this.ctx.strokeStyle = '#4A2A1A';
        if (this.expression === 'happy') {
            this.ctx.moveTo(this.width/2 - 70, this.height/2 - 70);
            this.ctx.quadraticCurveTo(this.width/2 - 50, this.height/2 - 85, this.width/2 - 30, this.height/2 - 70);
            this.ctx.moveTo(this.width/2 + 70, this.height/2 - 70);
            this.ctx.quadraticCurveTo(this.width/2 + 50, this.height/2 - 85, this.width/2 + 30, this.height/2 - 70);
        } else if (this.expression === 'sleepy') {
            this.ctx.moveTo(this.width/2 - 70, this.height/2 - 60);
            this.ctx.lineTo(this.width/2 - 30, this.height/2 - 60);
            this.ctx.moveTo(this.width/2 + 70, this.height/2 - 60);
            this.ctx.lineTo(this.width/2 + 30, this.height/2 - 60);
        } else {
            this.ctx.moveTo(this.width/2 - 70, this.height/2 - 70);
            this.ctx.lineTo(this.width/2 - 30, this.height/2 - 70);
            this.ctx.moveTo(this.width/2 + 70, this.height/2 - 70);
            this.ctx.lineTo(this.width/2 + 30, this.height/2 - 70);
        }
        this.ctx.stroke();

        // Miệng
        this.ctx.beginPath();
        this.ctx.lineWidth = 6;
        this.ctx.strokeStyle = '#8B4513';
        if (this.expression === 'happy') {
            this.ctx.arc(this.width/2, this.height/2 + 30, 35, 0.1, Math.PI - 0.1);
        } else if (this.expression === 'sad') {
            this.ctx.arc(this.width/2, this.height/2 + 40, 30, Math.PI + 0.2, Math.PI*2 - 0.2);
        } else if (this.expression === 'surprised') {
            this.ctx.arc(this.width/2, this.height/2 + 30, 20, 0, Math.PI*2);
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fill();
        } else if (this.expression === 'sleepy') {
            this.ctx.moveTo(this.width/2 - 25, this.height/2 + 40);
            this.ctx.lineTo(this.width/2 + 25, this.height/2 + 40);
        } else {
            this.ctx.arc(this.width/2, this.height/2 + 30, 25, 0, Math.PI);
        }
        this.ctx.stroke();

        // Má hồng
        if (this.expression === 'happy') {
            this.ctx.fillStyle = '#FFA07A';
            this.ctx.beginPath();
            this.ctx.arc(this.width/2 - 80, this.height/2 + 20, 12, 0, Math.PI*2);
            this.ctx.arc(this.width/2 + 80, this.height/2 + 20, 12, 0, Math.PI*2);
            this.ctx.fill();
        }
    }
}
