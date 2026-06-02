const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\murat\\.gemini\\antigravity-ide\\brain\\67f1f750-3528-4ca3-9bc0-91bd4adbd0a3';
const destDir = 'c:\\Users\\murat\\Replate\\frontend-baseapp\\public';

const files = [
    { pattern: /hero_podium_.*\.png$/, name: 'hero-podium.png' },
    { pattern: /rewards_coin_.*\.png$/, name: 'rewards-coin.png' },
    { pattern: /neon_globe_.*\.png$/, name: 'neon-globe.png' },
    { pattern: /avatar_one_.*\.png$/, name: 'avatar1.png' },
    { pattern: /avatar_two_.*\.png$/, name: 'avatar2.png' },
    { pattern: /avatar_three_.*\.png$/, name: 'avatar3.png' }
];

fs.readdirSync(srcDir).forEach(file => {
    files.forEach(f => {
        if (f.pattern.test(file)) {
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, f.name);
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied ${file} to ${f.name}`);
        }
    });
});
