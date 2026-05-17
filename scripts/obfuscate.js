// ========== OBFUSCATE PROTECTED FILES ==========
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const protectedDir = path.join(__dirname, '../protected/js');
const outputDir = protectedDir;

function obfuscateFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    
    const obfuscated = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        debugProtection: true,
        debugProtectionInterval: true,
        disableConsoleOutput: true,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: true,
        renameGlobals: false,
        selfDefending: true,
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 10,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayCallsTransformThreshold: 0.75,
        stringArrayEncoding: ['rc4'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 2,
        stringArrayWrappersChainedCalls: true,
        stringArrayWrappersParametersMaxCount: 4,
        stringArrayWrappersType: 'function',
        stringArrayThreshold: 0.75,
        transformObjectKeys: true,
        unicodeEscapeSequence: false
    });
    
    const outputPath = path.join(outputDir, path.basename(filePath));
    fs.writeFileSync(outputPath, obfuscated.getObfuscatedCode());
    console.log(`✅ Obfuscated: ${path.basename(filePath)}`);
}

function obfuscateDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            obfuscateDirectory(filePath);
        } else if (file.endsWith('.js')) {
            obfuscateFile(filePath);
        }
    }
}

console.log('🔒 Starting obfuscation...');
obfuscateDirectory(protectedDir);
console.log('✅ Obfuscation complete!');
