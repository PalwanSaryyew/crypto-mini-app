
import Binance from "node-binance-api";

// NEXT_PUBLIC_ önekli değişkenler doğrudan process.env üzerinden erişilebilir.
const API_KEY = process.env.NEXT_PUBLIC_BINANCE_API_KEY;
const SECRET_KEY = process.env.NEXT_PUBLIC_BINANCE_SECRET_KEY;
const MY_API_KEY = process.env.BINANCE_API_KEY;
const MYSECRET_KEY = process.env.BINANCE_API_SECRET;

// Binance API istemcisini testnet modunda başlatın
// node-binance-api için testnet'i true olarak ayarlamak Spot Testnet'e bağlanır.
export const binance = new Binance().options({
   APIKEY: API_KEY,
   APISECRET: SECRET_KEY,
   test: true, // Spot Testnet için bu çok önemlidir!
   verbose: true, // Hata ayıklama için yararlı olabilir
   recvWindow: 50000,
});
export const myBinance = new Binance().options({
   APIKEY: MY_API_KEY,
   APISECRET: MYSECRET_KEY,
   recvWindow: 50000,
});

export const authTokenName = 'watasiwa_token';