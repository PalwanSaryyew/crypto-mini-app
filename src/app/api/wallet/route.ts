// app/api/wallet/route.ts
import { NextResponse, type NextRequest } from 'next/server'; // NextRequest'ı import edin
import { verifyAuthToken } from '@/lib/auth'; // JWT doğrulaması için
import prisma from '../../../../prisma/prismaConf';
// Prisma istemcinizi import edin

export async function GET(request: NextRequest) { // Request tipini NextRequest olarak güncelleyin
    console.log('Fetching user crypto balances from database...');

    try {
        // 1. JWT'den Kullanıcı Kimliğini Çıkarın
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        console.log(token);
        
        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Kimlik doğrulama tokenı eksik.' },
                { status: 401 }
            );
        }

        const decodedToken = await verifyAuthToken(token);
        console.log('Decoded Token:', decodedToken);
        if (!decodedToken || !decodedToken.userId) { // JWT payload'ında user ID'sini kontrol edin
            return NextResponse.json(
                { success: false, error: 'Geçersiz veya süresi dolmuş token.' },
                { status: 401 }
            );
        }

        const userId = decodedToken.userId as string; // JWT'den gelen user ID

        // 2. Kullanıcının CryptoBalance kayıtlarını veritabanından çekin
        // Asset bilgisiyle birlikte çekmek için `include` kullanıyoruz.
        const userBalances = await prisma.cryptoBalance.findMany({
            where: {
                userId: userId,
                // İsteğe bağlı: Sadece bakiyesi sıfırdan büyük olanları filtreleyebilirsiniz
                // balance: {
                //   gt: 0 // Decimal tipi olduğu için bu şekilde filtreleme yapılabilir.
                // }
            },
            include: {
                asset: true, // İlişkili Asset modelini de getir
            },
        });
        console.log(userBalances);
        

        // 3. Verileri istenen formata dönüştürün
        // `desiredAssets` listesini artık burada kullanmanıza gerek kalmıyor,
        // çünkü direkt olarak kullanıcının bakiyelerini çekiyoruz.
        // Ancak, hala belirli varlıkları listelemek istiyorsanız, filtreleme yapabilirsiniz.
        const formattedBalances: { [key: string]: { available: string; onOrder: string } } = {};

        userBalances.forEach(cb => {
            if (cb.asset) { // Asset ilişkisinin mevcut olduğundan emin olun
                formattedBalances[cb.asset.id] = {
                    // Decimal tipini string'e dönüştürürken dikkatli olun.
                    // toFixed ile belirli bir ondalık basamağa yuvarlayabiliriz.
                    available: cb.balance.toFixed(8), // Varsayılan olarak 8 ondalık basamak kullanıldı
                    onOrder: "0.00000000" // `CryptoBalance` şemanızda `onOrder` alanı yoksa varsayılan sıfır bırakın
                                          // Eğer olsaydı, onu da cb.onOrder.toFixed(8) şeklinde eklerdiniz.
                };
            }
        });

        // Eğer kullanıcı belirli varlıkları hiç kaydetmediyse,
        // Binance'ten çekilen data gibi "sıfır" olarak döndürmek yerine,
        // sadece mevcut bakiyeleri dönüyoruz.
        // İsterseniz, burada manuel olarak "desiredAssets" listesine göre sıfır bakiye girişleri ekleyebilirsiniz.
        /*
        const desiredAssets = ['BTC', 'ETH', 'BNB', 'USDT', 'XRP', 'SOL', 'ADA', 'DOGE', 'TON'];
        desiredAssets.forEach(assetId => {
            if (!formattedBalances[assetId]) {
                formattedBalances[assetId] = { available: "0.00000000", onOrder: "0.00000000" };
            }
        });
        */

        return NextResponse.json({ success: true, data: formattedBalances });

    } catch (error) {
        console.error("Error while fetching user wallet from DB:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Cüzdan bilgileri alınamadı.",
                details: (error as Error).message,
            },
            { status: 500 }
        );
    }
}