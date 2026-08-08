import "./globals.css";

export const metadata = {
  title: "TREND54 — ניהול אירועי צילום",
  description: "פלטפורמה לניהול אירועי צילום, זיהוי פנים והדפסת מגנטים",
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
