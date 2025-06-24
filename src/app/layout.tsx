// app/layout.tsx
import './globals.css'; // Tailwind CSS veya kendi global CSS'iniz

export const metadata = {
  title: 'Kripto Piyasa Takip',
  description: 'Binance API ile kripto para alım satım ve takip uygulaması',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>
        {children}
      </body>
    </html>
  );
}