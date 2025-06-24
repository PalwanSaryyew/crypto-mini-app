// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAuthToken, getAuthTokenFromRequest } from "@/lib/auth";

// Middleware'ın Node.js Runtime'da çalışmasını zorluyoruz çünkü 'lib/auth.ts' hala 'crypto' kullanıyor
// Bu satırı şimdilik SİLİN MİYORUZ. Aşağıdaki açıklamalara bakın.

export async function middleware(request: NextRequest) {
   // Public rotalar (kimlik doğrulaması gerektirmeyenler)
   const publicRoutes = ["/api/auth/telegram"];

   // Eğer istek public rotalardan birine geliyorsa, devam et
   if (publicRoutes.includes(request.nextUrl.pathname)) {
      return NextResponse.next();
   }

   const token = getAuthTokenFromRequest(request);

   if (!token) {
      return NextResponse.json(
         { success: false, error: "Kimlik doğrulama tokenı eksik." },
         { status: 401 }
      );
   }

   // verifyAuthToken artık async olduğu için await kullanıyoruz
   const decodedToken = await verifyAuthToken(token);

   if (!decodedToken || !decodedToken.userId) {
      return NextResponse.json(
         { success: false, error: "Geçersiz veya süresi dolmuş token." },
         { status: 401 }
      );
   }

   const response = NextResponse.next();
   response.headers.set("X-User-Id", decodedToken.userId);
   return response;
}

// Middleware'in hangi yollar için çalışacağını belirler
export const config = {
    matcher: ['/api/:path*'], // Tüm /api yolları için çalıştır
};