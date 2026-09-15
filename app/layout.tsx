import "./auth-modern.css";

export const metadata = {
  title: "Luma AI",
  description: "Luma Affiliate Intelligence Workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
