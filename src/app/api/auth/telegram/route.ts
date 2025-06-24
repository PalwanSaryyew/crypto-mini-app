// app/api/auth/telegram/route.ts
import { NextResponse } from 'next/server';
import { validateTelegramInitData, generateAuthToken } from '@/lib/auth';
import prisma from '../../../../../prisma/prismaConf';

export async function POST(request: Request) {
  try {
    const { initData, phoneNumber } = await request.json(); // phoneNumber'ı da al

    if (!initData) {
      return NextResponse.json({ success: false, error: 'initData eksik.' }, { status: 400 });
    }

    // initData'yı doğrula
    const isValid = validateTelegramInitData(initData);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'initData doğrulaması başarısız.' }, { status: 401 });
    }

    const urlParams = new URLSearchParams(initData);
    const userString = urlParams.get('user');
    let userId: string;
    type TelegramUserData = {
      firstName: string | null;
      lastName: string | null;
      username: string | null;
      languageCode: string | null;
      isPremium: boolean | null;
    };
    let userData: TelegramUserData = {
      firstName: null,
      lastName: null,
      username: null,
      languageCode: null,
      isPremium: null,
    }; // Telegram user verilerini tutacak

    if (userString) {
      try {
        const user = JSON.parse(userString);
        userId = String(user.id); // userId string olmalı
        userData = {
          firstName: user.first_name || null,
          lastName: user.last_name || null,
          username: user.username || null,
          languageCode: user.language_code || null,
          isPremium: user.is_premium || null,
        };
      } catch (parseError) {
        console.warn('initData içindeki kullanıcı bilgisi ayrıştırılamadı:', parseError);
        return NextResponse.json({ success: false, error: 'Kullanıcı bilgisi geçersiz.', details: (parseError as Error).message }, { status: 400 });
      }
    } else {
      return NextResponse.json({ success: false, error: 'Kullanıcı bilgisi (user) eksik veya geçersiz.' }, { status: 400 });
    }

    // Kullanıcıyı veritabanında bul veya oluştur
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    let userInDb;
    if (existingUser) {
      // Mevcut kullanıcıyı güncelle (özellikle phoneNumber varsa)
      userInDb = await prisma.user.update({
        where: { id: userId },
        data: {
          ...userData, // Diğer Telegram verilerini de güncelle
          phoneNumber: phoneNumber || existingUser.phoneNumber, // Yeni numara varsa güncelle, yoksa eskisi kalsın
        },
      });
    } else {
      // Yeni kullanıcı oluştur
      userInDb = await prisma.user.create({
        data: {
          id: userId,
          ...userData,
          phoneNumber: phoneNumber || null,
        },
      });
    }

    // JWT payload'ına daha fazla bilgi ekleyebilirsiniz, örneğin telefon numarası
    const payload = {
      userId: userInDb.id,
      phoneNumber: userInDb.phoneNumber,
      // ... diğer istediğiniz bilgiler
    };

    const token = await generateAuthToken(payload, '1h'); // 1 saat geçerli token

    return NextResponse.json({ success: true, message: 'Kimlik doğrulama ve kullanıcı kaydı başarılı.', token: token });

  } catch (error) {
    console.error('Telegram kimlik doğrulama/kayıt hatası:', error);
    // Hata detayını frontend'e gönderebilirsiniz (yalnızca geliştirme aşamasında dikkatli olun)
    return NextResponse.json(
      { success: false, error: 'Kimlik doğrulama sırasında bir hata oluştu.', details: (error as Error).message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect(); // İstek bittikten sonra Prisma bağlantısını kapat
  }
}