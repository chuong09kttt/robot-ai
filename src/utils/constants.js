// ========== CONSTANTS ==========

// Fallback knowledge
const FALLBACK_KNOWLEDGE = {
    'vinfast': `Theo bài báo Dân trí ngày 13/5/2026, VinFast đang tái cấu trúc:
- Công ty Tương Lai (của ông Phạm Nhật Vượng) mua lại 2 nhà máy tại Hải Phòng và Hà Tĩnh với giá 13.309,6 tỷ đồng
- Đồng thời nhận lại khoảng 182.000 tỷ đồng nợ của VinFast
- Sau tái cấu trúc, VinFast sẽ không còn mảng sản xuất tại Việt Nam, thay vào đó thuê Công ty Tương Lai sản xuất
- VinFast vẫn giữ các mảng R&D, thiết kế, kinh doanh, bảo hành, hậu mãi
- VinFast dự kiến có lãi từ năm 2027`,
    
    'son la': 'Tỉnh Sơn La không nằm trong phương án sáp nhập theo tài liệu dự kiến. Sơn La giữ nguyên hiện trạng.',
    
    'sap nhap tinh': 'Theo tài liệu dự kiến, có 23 tỉnh thành mới được sáp nhập từ 63 tỉnh thành hiện tại.'
};

// Wake words for voice activation
const WAKE_WORDS = ['xin chào', 'hello', 'hi', 'chào chiri', 'chiri ơi'];

// Drive command mappings
const DRIVE_COMMANDS = {
    'tiến': 'FORWARD',
    'đi': 'FORWARD',
    'lùi': 'BACKWARD',
    'trái': 'LEFT',
    'phải': 'RIGHT',
    'dừng': 'STOP'
};

const DRIVE_REPLIES = {
    'FORWARD': '🚗 Xe tiến lên!',
    'BACKWARD': '🚗 Xe lùi lại!',
    'LEFT': '🚗 Xe rẽ trái!',
    'RIGHT': '🚗 Xe rẽ phải!',
    'STOP': '🛑 Xe dừng lại!'
};

// Language codes for TTS
const LANGUAGE_CODES = {
    'vi': 'vi-VN',
    'en': 'en-US',
    'zh': 'zh-CN',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'es': 'es-ES'
};

module.exports = {
    FALLBACK_KNOWLEDGE,
    WAKE_WORDS,
    DRIVE_COMMANDS,
    DRIVE_REPLIES,
    LANGUAGE_CODES
};
