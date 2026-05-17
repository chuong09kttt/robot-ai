// ========== HELPER FUNCTIONS ==========

// Detect language of text
function detectLanguage(text) {
    if (!text || text.length === 0) return 'vi';
    const vietnameseChars = /[àáảãạăâầấẩẫậêềếểễệôồốổỗộơờớởỡợưừứửữựđ]/i;
    return vietnameseChars.test(text) ? 'vi' : 'en';
}

// Get current time
function getCurrentTime(lang = 'vi') {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    
    if (lang === 'en') {
        const period = hours < 12 ? 'AM' : 'PM';
        const hour12 = hours % 12 || 12;
        return `It's ${hour12}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${period}.`;
    } else {
        let period = '';
        let hour12 = hours % 12;
        if (hour12 === 0) hour12 = 12;
        if (hours < 12) period = 'sáng';
        else if (hours < 18) period = 'chiều';
        else period = 'tối';
        return `Bây giờ là ${hour12} giờ ${minutes} phút ${seconds} giây ${period}.`;
    }
}

// Get current date
function getCurrentDate(lang = 'vi') {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    if (lang === 'en') {
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return `Today is ${weekdays[now.getDay()]}, ${months[month - 1]} ${day}, ${year}.`;
    } else {
        const weekdays = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
        return `Hôm nay là ${weekdays[now.getDay()]}, ngày ${day} tháng ${month} năm ${year}.`;
    }
}

// Simple reply when ChatGPT is not available
function getSimpleReply(userMessage, lang = 'vi') {
    const lower = userMessage.toLowerCase();
    
    if (lang === 'en') {
        if (lower.includes('hello') || lower.includes('hi')) {
            return 'Hello! I am Chiri AI, nice to meet you! 💕';
        }
        if (lower.includes('how are you')) {
            return 'I am doing great! Thank you for asking! 😊';
        }
        if (lower.includes('thank')) {
            return 'You\'re welcome! Happy to help you! 💖';
        }
        return `🤔 I heard you say: "${userMessage.slice(0, 50)}". I am still learning.`;
    } else {
        if (lower.includes('xin chào') || lower.includes('hello')) {
            return 'Xin chào bạn! Mình là Chiri AI, rất vui được gặp bạn! 💕';
        }
        if (lower.includes('khỏe') || lower.includes('khoẻ')) {
            return 'Mình rất tốt, cảm ơn bạn đã hỏi! 😊';
        }
        if (lower.includes('cảm ơn')) {
            return 'Không có gì đâu ạ! Rất vui khi được giúp bạn! 💖';
        }
        return `🤔 Mình nghe bạn nói: "${userMessage.slice(0, 50)}". Mình đang học hỏi thêm.`;
    }
}

// Parse drive command from text
function parseDriveCommand(text) {
    const lower = text.toLowerCase().trim();
    const cleanText = lower.replace(/đang|ơi|ạ|mình|hãy|làm ơn|cho|tôi/g, '');
    
    if (cleanText.includes('tiến') || cleanText === 'đi') return 'FORWARD';
    if (cleanText.includes('lùi')) return 'BACKWARD';
    if (cleanText.includes('trái')) return 'LEFT';
    if (cleanText.includes('phải')) return 'RIGHT';
    if (cleanText.includes('dừng')) return 'STOP';
    return null;
}

// Parse countdown command
function parseCountdownCommand(text) {
    const lower = text.toLowerCase();
    const match = lower.match(/(?:đếm ngược|countdown)\s*(\d+)\s*(giây|s)/i);
    if (match) {
        let seconds = parseInt(match[1]);
        if (seconds > 0 && seconds <= 3600) return { isCountdown: true, seconds };
    }
    return { isCountdown: false };
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    detectLanguage,
    getCurrentTime,
    getCurrentDate,
    getSimpleReply,
    parseDriveCommand,
    parseCountdownCommand,
    escapeHtml,
    delay
};
