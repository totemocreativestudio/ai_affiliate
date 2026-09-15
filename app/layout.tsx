import "./luma-v2.css";
import ReferralCapture from "./components/ReferralCapture";

export const metadata = {
  title: "Luma AI",
  description: "Luma AI Online",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body><ReferralCapture />{children}</body>
    </html>
  );
}
