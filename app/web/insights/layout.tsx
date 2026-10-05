import "./public-insights.css";

export default function PublicInsightsLayout({children}:{children:React.ReactNode}){
  return <div className="public-insights-shell"><a href="#main-content" className="skip-link">Lewati ke konten utama</a>{children}</div>;
}
