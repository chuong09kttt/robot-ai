// ========== RAG KNOWLEDGE BASE SERVICE ==========
const axios = require('axios');
const pdfParse = require('pdf-parse');
const cheerio = require('cheerio');
const { delay } = require('../utils/helpers');
const config = require('../config');

// Knowledge storage
let customKnowledge = [];
let knowledgeSource = '';

// Split text into chunks
function splitTextIntoChunks(text, maxChunkSize = 1000) {
    if (!text) return [];
    const chunks = [];
    const paragraphs = text.split(/\n\s*\n/);
    
    for (const paragraph of paragraphs) {
        if (paragraph.trim().length === 0) continue;
        if (paragraph.length <= maxChunkSize) {
            chunks.push(paragraph.trim());
        } else {
            const sentences = paragraph.split(/[.!?]+/);
            let currentChunk = '';
            for (const sentence of sentences) {
                const trimmed = sentence.trim();
                if (trimmed.length === 0) continue;
                if ((currentChunk + ' ' + trimmed).length < maxChunkSize) {
                    currentChunk += (currentChunk ? ' ' : '') + trimmed + '.';
                } else {
                    if (currentChunk) chunks.push(currentChunk.trim());
                    currentChunk = trimmed + '.';
                }
            }
            if (currentChunk) chunks.push(currentChunk.trim());
        }
    }
    return chunks;
}

// Extract keywords
function extractKeywords(text) {
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
    const words = cleanText.split(/\s+/);
    const stopwords = new Set(['và', 'của', 'có', 'là', 'một', 'với', 'cho', 'khi', 'đã', 'sẽ', 'được', 'không', 'các', 'những']);
    const keywords = [];
    for (const word of words) {
        if (word.length > 2 && !stopwords.has(word)) {
            keywords.push(word);
        }
    }
    return [...new Set(keywords.slice(0, 20))];
}

// Download from Google Drive
async function downloadFromGoogleDrive(fileId) {
    try {
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const response = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        const buffer = Buffer.from(response.data);
        try {
            const pdfData = await pdfParse(buffer);
            return pdfData.text;
        } catch (e) {
            return buffer.toString('utf-8');
        }
    } catch (error) {
        console.error('Google Drive download error:', error.message);
        return null;
    }
}

// Crawl website
async function crawlWebsite(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            timeout: 15000
        });
        
        const $ = cheerio.load(response.data);
        $('script, style, nav, footer, header, .sidebar, .navigation, iframe, .advertisement, .cookie-banner').remove();
        
        let content = '';
        const selectors = ['main', 'article', '.content', '.main-content', '#content', '.post-content', '.entry-content', 'body'];
        
        for (const selector of selectors) {
            const elements = $(selector);
            if (elements.length > 0) {
                content = elements.text().trim();
                if (content.length > 500) break;
            }
        }
        
        content = content.replace(/\s+/g, ' ').trim();
        return { url, title: $('title').text() || url, content };
        
    } catch (error) {
        console.error(`Crawl error ${url}:`, error.message);
        return null;
    }
}

// Add PDF to knowledge base
async function addPDF(fileContent, fileName) {
    const buffer = Buffer.from(fileContent, 'base64');
    let text = '';
    try {
        const pdfData = await pdfParse(buffer);
        text = pdfData.text;
    } catch (e) {
        text = buffer.toString('utf-8');
    }
    
    const chunks = splitTextIntoChunks(text);
    for (const chunk of chunks) {
        customKnowledge.push({
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            source: `Uploaded PDF: ${fileName}`,
            type: 'pdf',
            title: fileName,
            content: chunk,
            keywords: extractKeywords(chunk)
        });
    }
    
    return { success: true, message: `Đã thêm ${chunks.length} đoạn kiến thức từ PDF!` };
}

// Add website to knowledge base
async function addWebsite(url) {
    const data = await crawlWebsite(url);
    if (data) {
        const chunks = splitTextIntoChunks(data.content);
        for (const chunk of chunks) {
            customKnowledge.push({
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                source: url,
                type: 'website',
                title: data.title,
                content: chunk,
                keywords: extractKeywords(chunk)
            });
        }
        return { success: true, message: `Đã crawl và thêm ${chunks.length} đoạn từ website!` };
    }
    return { success: false, message: 'Không thể crawl website' };
}

// Add Google Drive file
async function addGoogleDrive(fileId) {
    const content = await downloadFromGoogleDrive(fileId);
    if (content) {
        const chunks = splitTextIntoChunks(content);
        for (const chunk of chunks) {
            customKnowledge.push({
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                source: `Google Drive: ${fileId}`,
                type: 'drive',
                title: 'Tài liệu từ Google Drive',
                content: chunk,
                keywords: extractKeywords(chunk)
            });
        }
        return { success: true, message: `Đã thêm ${chunks.length} đoạn từ Google Drive!` };
    }
    return { success: false, message: 'Không thể tải file từ Google Drive' };
}

// Search in knowledge base
function search(query) {
    if (customKnowledge.length === 0) return [];
    
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const results = [];
    
    for (const chunk of customKnowledge) {
        let score = 0;
        const chunkLower = chunk.content.toLowerCase();
        
        if (chunkLower.includes(queryLower)) score += 30;
        for (const word of queryWords) {
            if (chunkLower.includes(word)) score += 2;
            if (chunk.keywords && chunk.keywords.includes(word)) score += 5;
        }
        score += Math.min(10, chunk.content.length / 200);
        
        if (score > 5) {
            results.push({ score, content: chunk.content, source: chunk.source, title: chunk.title });
        }
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 3);
}

// Get knowledge stats
function getStats() {
    const sources = {};
    for (const item of customKnowledge) {
        sources[item.source] = (sources[item.source] || 0) + 1;
    }
    return {
        totalChunks: customKnowledge.length,
        sources: sources,
        knowledgeSource: knowledgeSource
    };
}

// Clear knowledge base
function clearKnowledge() {
    customKnowledge = [];
}

module.exports = {
    addPDF,
    addWebsite,
    addGoogleDrive,
    search,
    getStats,
    clearKnowledge
};
