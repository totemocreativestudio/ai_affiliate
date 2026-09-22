import { NextRequest, NextResponse } from "next/server";
import { getServerContext } from "../../../../lib/server-auth";

export const runtime="nodejs";

export async function DELETE(req:NextRequest){
  try{
    const body=await req.json();
    const workspaceId=String(body.workspace_id||"");
    const importId=String(body.import_id||"");
    if(!workspaceId||!importId)return NextResponse.json({ok:false,error:"workspace_id dan import_id wajib diisi."},{status:400});
    const ctx=await getServerContext(workspaceId);
    if(!ctx.canManage)return NextResponse.json({ok:false,error:"Role Anda tidak dapat menghapus import."},{status:403});
    const {admin}=ctx;
    const {data:record,error:findError}=await admin.from("imports").select("id,import_id,data_type,filename").eq("workspace_id",workspaceId).eq("import_id",importId).maybeSingle();
    if(findError)throw findError;
    if(!record)return NextResponse.json({ok:false,error:"Import tidak ditemukan."},{status:404});

    await admin.from("sales").delete().eq("workspace_id",workspaceId).eq("import_id",importId);
    await admin.from("creator_samples").delete().eq("workspace_id",workspaceId).eq("source_import_id",importId);
    await admin.from("product_platform_items").delete().eq("workspace_id",workspaceId).eq("source_import_id",importId);
    await admin.from("product_variants").delete().eq("workspace_id",workspaceId).eq("source_import_id",importId);
    await admin.from("product_hpp_history").delete().eq("workspace_id",workspaceId).eq("source_import_id",importId);

    if(record.data_type==="products"){
      const {data:candidates}=await admin.from("product_master")
        .select("id").eq("workspace_id",workspaceId).eq("source_import_id",importId);
      for(const product of candidates||[]){
        const [{count:mappingCount},{count:variantCount},{count:hppCount}]=await Promise.all([
          admin.from("product_platform_items").select("id",{count:"exact",head:true}).eq("workspace_id",workspaceId).eq("product_master_id",product.id),
          admin.from("product_variants").select("id",{count:"exact",head:true}).eq("workspace_id",workspaceId).eq("product_master_id",product.id),
          admin.from("product_hpp_history").select("id",{count:"exact",head:true}).eq("workspace_id",workspaceId).eq("product_master_id",product.id),
        ]);
        if(Number(mappingCount||0)===0&&Number(variantCount||0)===0&&Number(hppCount||0)===0){
          await admin.from("product_master").delete().eq("workspace_id",workspaceId).eq("id",product.id);
        }else{
          await admin.from("product_master").update({source_import_id:null}).eq("workspace_id",workspaceId).eq("id",product.id);
        }
      }
    }else{
      await admin.from("product_master").update({source_import_id:null}).eq("workspace_id",workspaceId).eq("source_import_id",importId);
    }
    // Creator rows are intentionally not deleted because they may already be referenced
    // by later imports / Customer 360 history. Only their source link is cleared.
    await admin.from("creators").update({source_import_id:null}).eq("workspace_id",workspaceId).eq("source_import_id",importId);
    const {error:deleteError}=await admin.from("imports").delete().eq("workspace_id",workspaceId).eq("import_id",importId);
    if(deleteError)throw deleteError;

    return NextResponse.json({ok:true,import_id:importId,filename:record.filename});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Gagal menghapus import."},{status:400});
  }
}
