const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Параметри - попълни тези стойности
const KEY_ID = 'SA5LZMLW98'; // От името на .p8 файла (AuthKey_SA5LZMLW98.p8)
const TEAM_ID = '5RQ9CQARF6'; // Team ID от Apple Developer
const SERVICES_ID = 'bg.tracksy.app.signin'; // Service ID
const P8_FILE_PATH = 'C:\\Users\\PC\\Desktop\\AuthKey_SA5LZMLW98.p8';

// Функция за base64url encoding (за Node.js версии без вграден base64url)
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Функция за генериране на JWT
function generateAppleClientSecret() {
  try {
    // Прочитай .p8 файла
    const privateKey = fs.readFileSync(P8_FILE_PATH, 'utf8');
    
    // JWT Header
    const header = {
      alg: 'ES256',
      kid: KEY_ID
    };
    
    // JWT Payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: TEAM_ID,
      iat: now,
      exp: now + (6 * 30 * 24 * 60 * 60), // 6 месеца валидност (15768000 секунди)
      aud: 'https://appleid.apple.com',
      sub: SERVICES_ID
    };
    
    // Encode header и payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    // Sign с ES256 алгоритъм (ECDSA с P-256 и SHA-256)
    const sign = crypto.createSign('SHA256');
    sign.update(signatureInput);
    sign.end();
    
    // Използвай private key за подписване
    const signature = sign.sign(privateKey, 'base64');
    
    // Конвертирай от base64 към base64url
    const encodedSignature = signature
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    // Създай JWT
    const jwt = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
    
    return jwt;
  } catch (error) {
    console.error('Грешка при генериране на JWT:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Проверка на параметрите
if (TEAM_ID === 'YOUR_TEAM_ID') {
  console.error('❌ Моля, попълни TEAM_ID в скрипта!');
  console.log('Намери го в Apple Developer → Membership (горния десен ъгъл)');
  process.exit(1);
}

// Проверка дали файлът съществува
if (!fs.existsSync(P8_FILE_PATH)) {
  console.error(`❌ Файлът не е намерен: ${P8_FILE_PATH}`);
  console.log('Уверете се че .p8 файлът е на правилното място');
  process.exit(1);
}

// Генерирай и покажи JWT
try {
  const jwt = generateAppleClientSecret();
  console.log('\n✅ Apple Client Secret (JWT) генериран успешно!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(jwt);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📋 Копирай този JWT токен и го постави в Supabase → Secret Key (for OAuth)\n');
} catch (error) {
  console.error('❌ Грешка:', error.message);
  process.exit(1);
}
