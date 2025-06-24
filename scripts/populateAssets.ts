import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function seedAssets() {
  try {
    console.log('Binance API\'den spot sembolleri çekiliyor...');

    // Binance Spot API'si üzerinden tüm sembolleri çekme
    const response = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
    const symbols = response.data.symbols;

    const assetsToCreate = [];
    const existingAssetIds: Set<string> = new Set(); // Mevcut varlıkların ID'lerini takip etmek için

    // Mevcut varlıkları veritabanından çek (performans için sadece ID'ler)
    const existingAssets = await prisma.asset.findMany({
      select: {
        id: true,
      },
    });
    existingAssets.forEach(asset => existingAssetIds.add(asset.id));

    for (const symbolInfo of symbols) {
      // Sadece spot ticaret çiftlerini ve alım satımı aktif olanları dikkate al
      if (symbolInfo.status === 'TRADING' && symbolInfo.isSpotTradingAllowed) {
        // baseAsset: Kripto paranın sembolü (örn: BTC)
        // baseAssetFullName: Kripto paranın tam adı (örn: Bitcoin) - API'de doğrudan bu bilgi yok,
        // ancak sembolden türetmek veya harici bir kaynaktan çekmek gerekebilir.
        // Binance API'si doğrudan tam isim sağlamaz, bu nedenle burada sembolü kullanıyoruz.
        // Daha iyi bir isim için bir harita oluşturabilir veya farklı bir API kullanabilirsiniz.

        const assetSymbol = symbolInfo.baseAsset;
        const assetName = symbolInfo.baseAsset; // Geçici olarak sembolü ad olarak kullanıyoruz

        // Eğer sembol zaten veritabanında yoksa ekle
        if (!existingAssetIds.has(assetSymbol)) {
          assetsToCreate.push({
            id: assetSymbol,
            name: assetName, // Gerçek adı almak için burayı güncelleyebilirsiniz
          });
        }
      }
    }

    if (assetsToCreate.length > 0) {
      console.log(`${assetsToCreate.length} yeni varlık veritabanına ekleniyor...`);
      // Toplu ekleme işlemi
      const result = await prisma.asset.createMany({
        data: assetsToCreate,
        skipDuplicates: true, // Zaten varsa atla (id @unique olduğu için hata vermesini engeller)
      });
      console.log(`${result.count} varlık başarıyla eklendi.`);
    } else {
      console.log('Eklenecek yeni varlık bulunamadı. Tüm varlıklar zaten mevcut olabilir.');
    }

  } catch (error) {
    console.error('Varlıklar eklenirken bir hata oluştu:', error);
  } finally {
    await prisma.$disconnect(); // Prisma bağlantısını kapat
  }
}

seedAssets();