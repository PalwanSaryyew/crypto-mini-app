// app/components/SignInButton.tsx
"use client";

import { useEffect, useState } from "react"; // useEffect'i ekleyin
import { webApp } from "@/lib/webapp";
import { authTokenName } from "@/lib/settings";

export default function SignInButton({}) {
   const [loading, setLoading] = useState(false);
   const [isLoggedIn, setIsLoggedIn] = useState(false); // Yeni: Kullanıcının giriş yapıp yapmadığını tutar
   const [token, setToken] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);

   // Bileşen yüklendiğinde veya JWT token değiştiğinde giriş durumunu kontrol et
   useEffect(() => {
      const token = localStorage.getItem("jwt_token");
      setIsLoggedIn(!!token); // Token varsa true, yoksa false
   }, []); // Boş bağımlılık dizisi ile sadece ilk render'da çalışır
   const onSignInError = (errorMessage: string) => {
      setToken(null);
      setError(errorMessage);
   };
   const onSignOut = () => {
      setToken(null); // Local state'i temizle
      setError(null); // Hataları temizle
      // Çıkış sonrası kullanıcıyı başka bir sayfaya yönlendirebilirsiniz
      // router.push('/');
   };
   const handleSignIn = async () => {
      setLoading(true);
      try {
         const WebApp = await webApp();

         if (!telegramInitData) {
            const errorMsg =
               "Telegram initData mevcut değil. Lütfen bir Telegram Mini App ortamında çalıştırın.";
            onSignInError(errorMsg);
            setLoading(false);
            return;
         }

         WebApp.ready(); // WebApp'in tamamen yüklendiğini bildir
         WebApp.expand(); // Mini App'i tam ekran yap (kullanıcı deneyimi için iyi)

         WebApp.requestContact(async (hasShared: boolean) => {
            if (hasShared) {
               onSignInError(""); // Önceki hataları temizle
               console.log(
                  "Kullanıcı telefon numarasını bot ile paylaşmayı kabul etti."
               );

               const response = await fetch("/api/auth/telegram", {
                  method: "POST",
                  headers: {
                     "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                     initData: telegramInitData,
                  }),
               });

               if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(
                     errorData.details ||
                        errorData.error ||
                        "Kimlik doğrulama başarısız oldu."
                  );
               }

               const data = await response.json();
               if (data.success && data.token) {
                  localStorage.setItem("jwt_token", data.token);
                  setIsLoggedIn(true); // Giriş başarılı oldu, durumu güncelle
                  onSignInSuccess(data.token);
               } else {
                  onSignInError(
                     data.error ||
                        "Bilinmeyen bir kimlik doğrulama hatası oluştu."
                  );
               }
            } else {
               console.log(
                  "Kullanıcı telefon numarasını paylaşmayı reddetti veya işlem iptal edildi."
               );
               // Kullanıcı numara paylaşmayı reddetse bile,
               // auth/telegram API'si kullanıcıyı kaydedebilir ve token verebilir.
               // Bu durumda, yine de API çağrısını yapmalıyız.
               // Ancak, bu spesifik use-case için WebApp.requestContact() içine alınmış,
               // yani sadece numara paylaşıldığında token almaya çalışıyor.
               // Eğer numara paylaşılmadığında da token almak istiyorsanız,
               // fetch kısmını `if (hasShared)` bloğunun dışına taşımanız gerekebilir.
               // Şu anki kurgunuzda numara paylaşılmazsa token alınmıyor.
               onSignInError(
                  "Telefon numarası paylaşılmadığı için giriş yapılamadı."
               );
            }
            setLoading(false); // Yükleme durumunu kapat
         });
      } catch (err) {
         console.error("Kimlik doğrulama sırasında hata:", err);
         onSignInError((err as Error).message);
         setLoading(false); // Yükleme durumunu kapat
      }
   };

   const handleSignOut = () => {
      localStorage.removeItem(authTokenName); // Token'ı kaldır
      setIsLoggedIn(false); // Giriş durumunu güncelle
      onSignOut(); // Üst bileşene haber ver
      console.log("Kullanıcı çıkış yaptı.");
   };

   return (
      <div className="mt-8">
         {isLoggedIn ? (
            <button
               onClick={handleSignOut}
               className="bg-red-500 text-white p-3 rounded-lg shadow-md hover:bg-red-600"
            >
               Çıkış Yap
            </button>
         ) : (
            <button
               onClick={handleSignIn}
               className="bg-green-500 text-white p-3 rounded-lg shadow-md hover:bg-green-600 disabled:opacity-50"
               disabled={loading || !telegramInitData}
            >
               {loading
                  ? "Giriş Yapılıyor..."
                  : "Telegram ile Giriş Yap / Numara Paylaş"}
            </button>
         )}

         {!telegramInitData && (
            <p className="text-red-500 text-sm mt-2">
               Telegram Mini App ortamında değilsiniz veya initData alınamadı.
            </p>
         )}
      </div>
   );
}
