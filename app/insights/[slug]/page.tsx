import PublicInsightDetail,{generateMetadata as sourceGenerateMetadata} from "../../web/insights/[slug]/page";

export const dynamic="force-dynamic";

export async function generateMetadata(props:{params:Promise<{slug:string}>}){
  return sourceGenerateMetadata(props);
}

export default PublicInsightDetail;
