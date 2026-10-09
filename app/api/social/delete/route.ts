import {NextRequest,NextResponse} from "next/server";
import {getServerContext} from "../../../../lib/server-auth";

export const runtime="nodejs";

export async function POST(req:NextRequest){
 try{
  const body=await req.json();
  const workspaceId=String(body.workspace_id||"");
  const postId=Number(body.post_id);
  if(!workspaceId||!Number.isSafeInteger(postId)||postId<=0)
   return NextResponse.json({ok:false,error:"Permintaan tidak valid."},{status:400});
  const ctx=await getServerContext(workspaceId);
  const {data:post,error:readError}=await ctx.admin.from("luma_community_posts")
   .select("id,user_id,image_storage_path,image_storage_paths").eq("id",postId).maybeSingle();
  if(readError||!post)return NextResponse.json({ok:false,error:"Post tidak ditemukan."},{status:404});
  // Ownership must be checked server-side; RLS alone does not guard a service-role client.
  if(post.user_id!==ctx.user.id)
   return NextResponse.json({ok:false,error:"Anda hanya bisa menghapus post sendiri."},{status:403});
  const paths=[...(Array.isArray(post.image_storage_paths)?post.image_storage_paths:[]),post.image_storage_path]
   .filter((x):x is string=>typeof x==="string"&&x.startsWith("community/"+ctx.user.id+"/"))
   .filter((x,i,a)=>a.indexOf(x)===i);
  const {error:archiveError}=await ctx.admin.from("luma_social_archives")
   .delete().eq("community_post_id",postId).eq("user_id",ctx.user.id);
  if(archiveError)throw archiveError;
  const {error:deleteError}=await ctx.admin.from("luma_community_posts").delete().eq("id",postId).eq("user_id",ctx.user.id);
  if(deleteError)throw deleteError;
  let mediaDeleted=true;
  if(paths.length){
   const {error:storageError}=await ctx.admin.storage.from("luma-public").remove(paths);
   mediaDeleted=!storageError;
  }
  return NextResponse.json({ok:true,media_deleted:mediaDeleted});
 }catch{
  return NextResponse.json({ok:false,error:"Gagal menghapus post. Coba lagi."},{status:500});
 }
}
