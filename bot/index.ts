// bot/index.ts
import { Bot, InlineKeyboard } from "grammy";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" }); // Kök dizindeki .env dosyasını yükle

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL; // Next.js uygulamanızın URL'si

if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN ortam değişkeni tanımlanmamış.");
}
if (!WEB_APP_URL) {
    console.warn(
        "WEB_APP_URL ortam değişkeni tanımlanmamış. WebApp düğmesi düzgün çalışmayabilir."
    );
}

const prisma = new PrismaClient(); // Prisma istemcisini başlat

// Bot örneğini oluştur
const bot = new Bot(BOT_TOKEN);

// Yardımcı bekleme fonksiyonu
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Başlangıç komutunu işle
bot.command("start", async (ctx) => {
    const keyboard = new InlineKeyboard().webApp(
        "Uygulamayı Aç",
        WEB_APP_URL || "https://web.telegram.org/a/"
    );

    await ctx.reply(
        "Merhaba! Uygulamamızı açmak için aşağıdaki düğmeyi kullanın.",
        {
            reply_markup: keyboard,
        }
    );
});

// Kullanıcı bir telefon numarası paylaştığında (WebApp üzerinden veya özel klavye ile)
bot.on(":contact", async (ctx) => {
    const contact = ctx.message?.contact;
    const telegramUserId = ctx.from?.id; // Mesajı gönderen kullanıcının Telegram ID'si
    if (contact?.user_id !== telegramUserId) {
        return ctx.reply("Bu telefon numarası sizinle eşleşmiyor. Lütfen tekrar deneyin.");
    }

    if (contact && telegramUserId) {

        // Kullanıcının veritabanına kaydedilmesi için kısa bir bekleme ekleyelim
        // Örneğin 3 saniye (3000 milisaniye) bekleyelim. Bu süreyi denemeniz gerekebilir.
        const RETRY_ATTEMPTS = 5;
        const DELAY_MS = 1000; // Her deneme arasında 1 saniye bekle

        for (let i = 0; i < RETRY_ATTEMPTS; i++) {
            try {
                // Kullanıcıyı veritabanında bulmaya çalış
                const existingUser = await prisma.user.findUnique({
                    where: { id: String(telegramUserId) },
                });

                if (existingUser) {
                    // Kullanıcı bulundu, şimdi güncelleyebiliriz
                    const user = await prisma.user.update({
                        where: { id: String(telegramUserId) },
                        data: {
                            phoneNumber: contact.phone_number,
                            firstName: ctx.from?.first_name || null,
                            lastName: ctx.from?.last_name || null,
                            username: ctx.from?.username || null,
                        },
                    });
                    console.log(
                        `Kullanıcı ${user.id} için telefon numarası veritabanına kaydedildi.`
                    );
                    /* await ctx.reply("Telefon numaranız başarıyla kaydedildi!"); */
                    return; // İşlem başarılı, fonksiyondan çık
                } else {
                    console.log(`Kullanıcı ${telegramUserId} henüz bulunamadı. ${i + 1}. deneme...`);
                    await delay(DELAY_MS); // Kullanıcı bulunamazsa bekle ve tekrar dene
                }
            } catch (error) {
                console.error(
                    `Telefon numarasını veritabanına kaydederken hata (deneme ${i + 1}):`,
                    error
                );
                await delay(DELAY_MS); // Hata olursa da bekle ve tekrar dene
            }
        }

        // Tüm denemeler başarısız olursa
        console.error(`Kullanıcı ${telegramUserId} için telefon numarası kaydedilemedi: Tüm denemeler başarısız oldu.`);
        await ctx.reply("Telefon numaranızı kaydederken bir sorun oluştu. Lütfen tekrar deneyin veya daha sonra uygulamayı kontrol edin.");

    } else {
        console.log("Geçersiz telefon numarası paylaşım mesajı alındı.");
        await ctx.reply("Telefon numaranızı algılayamadım.");
    }
});

// Hata yönetimi
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[Bot Hata] ${ctx.update.update_id}:`, err);
});

// Botu başlat
bot.start();
console.log("Telegram botu başlatıldı.");

// Süreç sona erdiğinde Prisma bağlantısını kapat
process.once("SIGINT", () => prisma.$disconnect());
process.once("SIGTERM", () => prisma.$disconnect());