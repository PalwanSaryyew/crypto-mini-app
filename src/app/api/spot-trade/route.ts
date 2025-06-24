import { binance } from "@/lib/settings";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
   try {
      const userId = request.headers.get("X-User-Id");

      if (!userId) {
         return NextResponse.json(
            {
               success: false,
               error: "Kullanıcı kimliği bulunamadı. (Middleware hatası)",
            },
            { status: 401 }
         );
      }

      const body = await request.json();
      const { symbol, side, quantity, useQuoteQuantity } = body;

      // Gerekli parametrelerin kontrolü
      if (!symbol || !side || !quantity) {
         return NextResponse.json(
            {
               success: false,
               error: "Required parameters are missing: symbol, side, quantity.",
            },
            { status: 400 }
         );
      }

      // Sembolü büyük harfe çevir
      const upperCaseSymbol = symbol.toUpperCase();
      // Bakiye kontrolü ve güncellemesi için sembolleri ayır
      let baseAsset, quoteAsset;
      if (upperCaseSymbol.endsWith("USDT")) {
         quoteAsset = "USDT";
         baseAsset = upperCaseSymbol.slice(0, -4);
      } else if (upperCaseSymbol.endsWith("BTC")) {
         quoteAsset = "BTC";
         baseAsset = upperCaseSymbol.slice(0, -3);
      } else if (upperCaseSymbol.endsWith("ETH")) {
         quoteAsset = "ETH";
         baseAsset = upperCaseSymbol.slice(0, -3);
      } else {
         return NextResponse.json(
            {
               success: false,
               error: "Unsupported symbol format. Must end with USDT, BTC, or ETH.",
            },
            { status: 400 }
         );
      }

      const balanceAsset = side === "buy" ? quoteAsset : baseAsset
      let assetAmount = quantity; // Kontrol edilecek bakiye
      console.log(baseAsset, quoteAsset, balanceAsset);

      // Kullanıcının bakiyesini kontrol et
      const userBalance = await prisma.cryptoBalance.findUnique({
         where: {
            assetId_userId: {
               assetId: balanceAsset,
               userId: userId,
            },
         },
         include: { asset: true },
      });

      if (
         (side === "buy" && !useQuoteQuantity) ||
         (side === "sell" && useQuoteQuantity)
      ) {
         const ticker = await binance.prices(upperCaseSymbol);
         assetAmount =
            side === "buy"
               ? ticker[upperCaseSymbol] * quantity
               : quantity / ticker[upperCaseSymbol];
      }
      if (
         !userBalance ||
         userBalance.balance.toNumber() < parseFloat(assetAmount)
      ) {
         return NextResponse.json(
            {
               success: false,
               error: `Yetersiz ${balanceAsset} bakiyesi.`,
            },
            { status: 400 }
         );
      }

      let orderResult;

      // İşlem tipine (BUY/SELL) göre emir oluştur
      if (side.toUpperCase() === "BUY") {
         if (useQuoteQuantity) {
            // USDT cinsinden piyasa alım emri
            const tradeQuoteQty = parseFloat(quantity);
            if (isNaN(tradeQuoteQty) || tradeQuoteQty <= 0) {
               return NextResponse.json(
                  { success: false, error: "Invalid quoteOrderQty value." },
                  { status: 400 }
               );
            }
            orderResult = await binance.marketBuy(upperCaseSymbol, 0, {
               quoteOrderQty: tradeQuoteQty,
            });
         } else {
            // Kripto para cinsinden piyasa alım emri
            const tradeQuantity = parseFloat(quantity);
            if (isNaN(tradeQuantity) || tradeQuantity <= 0) {
               return NextResponse.json(
                  { success: false, error: "Invalid quantity value." },
                  { status: 400 }
               );
            }
            orderResult = await binance.marketBuy(
               upperCaseSymbol,
               tradeQuantity
            );
         }
      } else if (side.toUpperCase() === "SELL") {
         if (useQuoteQuantity) {
            // USDT cinsinden piyasa satım emri
            const tradeQuoteQty = parseFloat(quantity);
            if (isNaN(tradeQuoteQty) || tradeQuoteQty <= 0) {
               return NextResponse.json(
                  { success: false, error: "Invalid quoteOrderQty value." },
                  { status: 400 }
               );
            }
            orderResult = await binance.marketSell(upperCaseSymbol, 0, {
               quoteOrderQty: tradeQuoteQty,
            });
         } else {
            // Kripto para cinsinden piyasa satım emri
            const tradeQuantity = parseFloat(quantity);
            if (isNaN(tradeQuantity) || tradeQuantity <= 0) {
               return NextResponse.json(
                  { success: false, error: "Invalid quantity value." },
                  { status: 400 }
               );
            }
            orderResult = await binance.marketSell(
               upperCaseSymbol,
               tradeQuantity
            );
         }
      } else {
         return NextResponse.json(
            {
               success: false,
               error: 'Invalid side value. Should be "BUY" or "SELL".',
            },
            { status: 400 }
         );
      }

      // İşlem başarılıysa bakiyeyi güncelle
      if (orderResult && orderResult.status === "FILLED") {
         console.log(orderResult);
         const executedQty = parseFloat(orderResult.executedQty);
         const executedQuoteQty = parseFloat(orderResult.cummulativeQuoteQty);

         if (side.toUpperCase() === "BUY") {
            // USDT harca, baseAsset (BTC) ekle
            await prisma.cryptoBalance.update({
               where: { assetId_userId: { userId, assetId: quoteAsset } },
               data: { balance: { decrement: executedQuoteQty } },
            });
            await prisma.cryptoBalance.upsert({
               where: { assetId_userId: { userId, assetId: baseAsset } },
               create: { userId, assetId: baseAsset, balance: executedQty },
               update: { balance: { increment: executedQty } },
            });
         } else if (side.toUpperCase() === "SELL") {
            // baseAsset harca, USDT ekle
            await prisma.cryptoBalance.update({
               where: { assetId_userId: { userId, assetId: baseAsset } },
               data: { balance: { decrement: executedQty } },
            });
            await prisma.cryptoBalance.upsert({
               where: { assetId_userId: { userId, assetId: quoteAsset } },
               create: {
                  userId,
                  assetId: quoteAsset,
                  balance: executedQuoteQty,
               },
               update: { balance: { increment: executedQuoteQty } },
            });
         }
      }

      // Başarılı emir oluşturma yanıtı
      return NextResponse.json({
         success: true,
         message: "The order was created successfully.",
         order: orderResult,
      });
   } catch (error) {
      console.error("Spot Trading error:", error);
      let errorMessage = "An error occurred during the operation.";
      if (error instanceof Error) {
         errorMessage = error.message;
         try {
            const parsedError = JSON.parse(error.message);
            if (parsedError.code && parsedError.msg) {
               errorMessage = `API Error (${parsedError.code}): ${parsedError.msg}`;
            }
         } catch {
            // JSON parse edilemezse, orijinal mesajı kullan
         }
      }

      return NextResponse.json(
         {
            success: false,
            error: errorMessage,
            details: (error as Error).message,
         },
         { status: 500 }
      );
   } finally {
      await prisma.$disconnect();
   }
}
