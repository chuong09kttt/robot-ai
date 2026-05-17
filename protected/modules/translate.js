// ========== TRANSLATE MODULE ==========
// This file will be obfuscated

(function() {
    let recognition = null;
    let sourceLang = 'vi';
    let targetLang = 'en';
    let timeout = null;
    let lastText = '';
    
    window.initTranslateUI = function() {
        console.log('🌐 Translate mode initialized');
        
        sourceLang = document.getElementById('sourceLang').value;
        targetLang = document.getElementById('targetLang').value;
        
        document.getElementById('swapLangBtn').onclick = swapLanguages;
        document.getElementById('speakTranslationBtn').onclick = speakTranslation;
        document.getElementById('clearTranslationBtn').onclick = clearTranslation;
        
        startRecognition();
    };
    
    function startRecognition() {
        if (recognition) recognition.stop();
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = getLanguageCode(sourceLang);
        
        recognition.onstart = () => {
            const status = document.getElementById('translateStatusText');
            if (status) status.innerHTML = '🎤 LISTENING...';
        };
        
        recognition.onresult = async (event) => {
            let finalText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalText += event.results[i][0].transcript;
                }
            }
            
            if (finalText && finalText !== lastText) {
                document.getElementById('originalText').innerHTML = escapeHtml(finalText);
                
                if (timeout) clearTimeout(timeout);
                timeout = setTimeout(async () => {
                    const translated = await translate(finalText, sourceLang, targetLang);
                    document.getElementById('translatedText').innerHTML = escapeHtml(translated);
                    lastText = finalText;
                }, 500);
            }
        };
        
        recognition.onend = () => {
            setTimeout(() => { if (recognition) recognition.start(); }, 500);
        };
        
        recognition.start();
    }
    
    async function translate(text, source, target) {
        if (source === target) return text;
        try {
            const res = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, source, target }),
                credentials: 'include'
            });
            const data = await res.json();
            return data.translated || text;
        } catch(e) {
            return text;
        }
    }
    
    function swapLanguages() {
        const temp = sourceLang;
        sourceLang = targetLang;
        targetLang = temp;
        document.getElementById('sourceLang').value = sourceLang;
        document.getElementById('targetLang').value = targetLang;
        clearTranslation();
        if (recognition) {
            recognition.stop();
            startRecognition();
        }
    }
    
    function speakTranslation() {
        const text = document.getElementById('translatedText').innerText;
        if (text && text !== 'AWAITING INPUT...') {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = getLanguageCode(targetLang);
            window.speechSynthesis.speak(utterance);
        }
    }
    
    function clearTranslation() {
        document.getElementById('originalText').innerHTML = 'AWAITING INPUT...';
        document.getElementById('translatedText').innerHTML = 'AWAITING INPUT...';
        lastText = '';
    }
    
    function getLanguageCode(lang) {
        const codes = { vi: 'vi-VN', en: 'en-US', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };
        return codes[lang] || 'en-US';
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    window.toggleTranslatorMode = function() {
        if (window.CHIRI.isTranslatorMode) {
            if (recognition) recognition.stop();
            window.CHIRI.isTranslatorMode = false;
        } else {
            startRecognition();
            window.CHIRI.isTranslatorMode = true;
        }
    };
})();
