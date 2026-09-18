import "./luma-v2.css";
import "./luma-social.css";
import "./luma-social-extra.css";
import "./creator360.css";
import "./owner-monitoring.css";
import "./product-ui.css";
import "./production-polish.css";
import "./luma-helpdesk.css";
import "./runtime-guard.css";
import "./luma-route-ui-hotfix.css";
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
  colorScheme: "light",
  themeColor: "#f6f7fb",
};

const themeBoot = `(()=>{try{document.documentElement.dataset.theme='light';localStorage.removeItem('lumaway_theme')}catch{}})();`;

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
