// app/page.tsx (veya ilgili sayfanız)
"use client";

import { useState, useEffect } from "react";
// Doğru yolu kontrol edin
import { webApp } from "@/lib/webapp"; // webApp utility'nizi import edin
import SignInButton from "@/components/SignInButton";

export default function HomePage() {
   
   const [telegramInitData, setTelegramInitData] = useState<string | null>(
      null
   );

   useEffect(() => {
      const fetchInitData = async () => {
         if (typeof window !== "undefined") {
            const WebApp = await webApp();
            if (WebApp && WebApp.initData) {
               setTelegramInitData(WebApp.initData);
               console.log("Telegram Init Data fetched:", WebApp.initData);
            } else {
               console.warn(
                  "Telegram initData is not available in this environment."
               );
            }
         }
      };

      fetchInitData();

      // Sayfa yüklendiğinde localStorage'dan tokenı kontrol et
      const storedToken = localStorage.getItem("jwt_token");
      if (storedToken) {
         setToken(storedToken);
      }
   }, []);

   const handleSignInSuccess = (newToken: string) => {
      setToken(newToken);
      setError(null);
      // Başarılı girişten sonra kullanıcıyı başka bir sayfaya yönlendirebilirsiniz
      // router.push('/dashboard');
   };

   

   

   return (
      <main className="flex min-h-screen flex-col items-center justify-between p-24">
         <h1 className="text-4xl font-bold mb-8">
            Kripto Uygulamasına Hoş Geldiniz
         </h1>

         {token ? (
            <div>
               <p
                  className="text-lg text-green-600 mb-4 cursor-pointer select-all"
                  title="Kopyalamak için tıklayın"
                  onClick={() => {
                     if (token) {
                        navigator.clipboard.writeText(token);
                     }
                  }}
               >
                  Giriş Yapıldı! Token: {token}...
               </p>
               {/* Token ile yapabileceğiniz diğer işlemler veya yönlendirmeler */}
               <button
                  onClick={() => alert("Cüzdanım sayfasına git")}
                  className="bg-blue-500 text-white p-3 rounded-lg shadow-md hover:bg-blue-600 mr-2"
               >
                  Cüzdanım
               </button>
               {/* Diğer bileşenler */}
            </div>
         ) : (
            <p className="text-lg text-gray-700">
               Giriş yapmak için aşağıdaki düğmeyi kullanın.
            </p>
         )}

         <SignInButton
            onSignInSuccess={handleSignInSuccess}
            onSignInError={handleSignInError}

            telegramInitData={telegramInitData}
         />

         {error && <p className="text-red-500 mt-4">{error}</p>}
      </main>
   );
}
