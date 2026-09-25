import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const migrationDir=path.join(root,"supabase","migrations");

if(!fs.existsSync(migrationDir)){
  console.error("Missing supabase/migrations directory.");
  process.exit(1);
}

const files=fs.readdirSync(migrationDir).filter(name=>name.endsWith(".sql")).sort();
const pattern=/^(\d{14})_([a-z0-9_]+)\.sql$/;
const seen=new Map();
const problems=[];

for(const file of files){
  const match=file.match(pattern);
  if(!match){
    problems.push(`Invalid migration filename: ${file}. Expected YYYYMMDDHHMMSS_snake_case.sql`);
    continue;
  }
  const [,version]=match;
  if(seen.has(version))problems.push(`Duplicate migration timestamp ${version}: ${seen.get(version)} and ${file}`);
  seen.set(version,file);

  const content=fs.readFileSync(path.join(migrationDir,file),"utf8");
  const forbidden=[
    /sb_secret_[A-Za-z0-9_-]+/i,
    /postgresql:\/\/[^\s]+:[^\s]+@/i,
    /OPENAI_API_KEY\s*=\s*[^\s'"]+/i,
    /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s'"]+/i,
  ];
  if(forbidden.some(rx=>rx.test(content)))problems.push(`Potential secret detected in ${file}`);
}

if(problems.length){
  console.error("\nDatabase migration validation failed:\n- "+problems.join("\n- "));
  process.exit(1);
}

console.log(`Database migration validation passed: ${files.length} migration files checked.`);
