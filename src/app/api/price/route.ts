// app/api/price/route.ts
import { binance } from '@/lib/settings';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'The symbol parameter is missing.' },
        { status: 400 } // 
      );
    }

    const upperCaseSymbol = symbol.toUpperCase();

    // Binance API'den sembolün son işlem fiyatını çek
    // ticker() metodu tüm sembollerin fiyatlarını veya belirli bir sembolün fiyatını döndürebilir.
    // Tek bir sembol için: binance.prices(upperCaseSymbol) de kullanılabilir.
    const ticker = await binance.prices(upperCaseSymbol);
    console.log(ticker);
    

    if (!ticker || !ticker[upperCaseSymbol]) {
      return NextResponse.json(
        { success: false, error: `No price found for Symbol ${upperCaseSymbol}.` },
        { status: 404 } // Not Found
      );
    }

    const price = ticker[upperCaseSymbol];
    console.log(price);

    return NextResponse.json({ success: true, symbol: upperCaseSymbol, price: price });
  } catch (error) {
    console.error('Binance API error while fetching price:', error);
    return NextResponse.json(
      { success: false, error: 'Price information could not be obtained.', details: (error as Error).message },
      { status: 500 } // Internal Server Error
    );
  }
}