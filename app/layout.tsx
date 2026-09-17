import "./luma-v2.css";
import "./luma-social.css";
import "./luma-social-extra.css";
import "./creator360.css";
import "./owner-monitoring.css";
import "./product-ui.css";
import "./production-polish.css";
import "./luma-helpdesk.css";
import "./runtime-guard.css";
import ReferralCapture from "./components/ReferralCapture";

export const metadata = {
  title: "Lumaway",
  description: "Lumaway — Light Up Your Potential.",
  manifest: "/manifest.webmanifest",
  applicationName: "Lumaway",
  appleWebApp: {
    capable: true,
    title: "Lumaway",
    statusBarStyle: "black-translucent" as const,
  },
  icons: {
    icon: "/luma-mark.png",
    apple: "/luma-mark.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
  ],
};

const themeBoot = `(()=>{try{const s=localStorage.getItem('lumaway_theme');const t=s==='dark'||s==='light'?s:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch{}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <ReferralCapture />
        {children}
      </body>
    </html>
  );
}
