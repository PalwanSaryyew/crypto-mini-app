// lib/auth.ts
// 'crypto' import'unu kaldırıyoruz!
// import * as crypto from 'crypto'; // BU SATIRI SİLİN

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// Ortam değişkenlerini güvenli bir şekilde yükleyin
const JWT_SECRET_B64 = process.env.JOSE_SECRET_B64;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!JWT_SECRET_B64) {
  throw new Error('JOSE_SECRET_B64 ortam değişkeni tanımlanmamış.');
}
if (!TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN ortam değişkeni tanımlanmamış.');
  throw new Error('TELEGRAM_BOT_TOKEN ortam değişkeni tanımlanmamış.');
}
interface JwtPayload {
    userId: string;
    // Diğer payload verileri
}

// Base64url kodlu secret'ı Uint8Array'e dönüştür
const encoder = new TextEncoder();
const getSecretKey = () => {
  return encoder.encode(JWT_SECRET_B64);
};

// --- Web Crypto API'leri ile HMAC SHA256 hesaplama fonksiyonu ---
async function hmacSha256(key: Uint8Array, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(data)
  );

  // ArrayBuffer'ı hex string'e dönüştür
  const hashArray = Array.from(new Uint8Array(signature));
  const hexHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hexHash;
}

// Telegram initData'yı doğrulamak için kullanılan helper fonksiyon (Web Crypto ile güncellendi)
export async function validateTelegramInitData(initData: string): Promise<boolean> { // ASYNC OLDU!
  const data = initData.split('&hash=');
  if (data.length !== 2) {
    console.error('initData formatı geçersiz: hash kısmı bulunamadı.');
    return false;
  }

  const [dataCheckString, hash] = data;

  const entries = dataCheckString
    .split('&')
    .map(entry => {
        const parts = entry.split('=');
        return [decodeURIComponent(parts[0]), decodeURIComponent(parts.slice(1).join('='))];
    })
    .sort((a, b) => a[0].localeCompare(b[0]));

  const dataCheckStringForHash = entries
    .filter(([key]) => key !== 'hash')
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Telegram bot token'ının SHA256 hash'i değil, WebAppData ile oluşturulan HMAC secret key
  /* const botTokenBytes = encoder.encode(TELEGRAM_BOT_TOKEN as string); // Bot token'ı Uint8Array'e dönüştür
  const secretKeyForHmac = await hmacSha256(encoder.encode('WebAppData'), TELEGRAM_BOT_TOKEN as string); */

  // secretKeyForHmac string döndürdüğü için, bunu tekrar Uint8Array'e dönüştürmeliyiz
  // VEYA direkt olarak importKey'e raw arraybuffer vermeliyiz.
  // Telegram dokümantasyonuna göre secret key oluşturma adımını doğru yapalım:
  // HMAC SHA256(WebAppData, bot_token) -> Bu doğrudan secretKey'dir.
  // Kodu bu adıma uygun hale getirelim:

  // WebAppData stringini key olarak kullan
  const webAppDataKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Bu key ile TELEGRAM_BOT_TOKEN'ı HMAC et
  const secretKeyDigest = await crypto.subtle.sign(
    'HMAC',
    webAppDataKey,
    encoder.encode(TELEGRAM_BOT_TOKEN as string)
  );

  const secretKeyDigestBytes = new Uint8Array(secretKeyDigest); // ArrayBuffer'ı Uint8Array'e dönüştür


  // Şimdi asıl HMAC SHA256 hesaplaması
  const calculatedHash = await hmacSha256(secretKeyDigestBytes, dataCheckStringForHash); // await kullan

  console.log('--- Hash Karşılaştırması ---');
  console.log('Hesaplanan Hash:', calculatedHash);
  console.log('Gelen Hash:', hash);
  console.log('-------------------------');

  return calculatedHash === hash;
}

// JWT Token oluşturma fonksiyonu (jose ile)
export async function generateAuthToken(payload: JWTPayload, expiresIn: string | number = '1h'): Promise<string> {
  const secret = getSecretKey();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

// JWT Token doğrulama fonksiyonu (jose ile)
export async function verifyAuthToken(token: string): Promise<JwtPayload | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    // 'userId' özelliği olup olmadığını kontrol et
    if (typeof payload.userId === 'string') {
      return payload as unknown as JwtPayload;
    } else {
      console.error('JWT payload userId eksik veya geçersiz.');
      return null;
    }
  } catch (error) {
    console.error('JWT doğrulama hatası:', error);
    return null;
  }
}

// Bir API isteğinden Authorization header'daki JWT'yi ayrıştırma fonksiyonu (Değişmedi)
export function getAuthTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}