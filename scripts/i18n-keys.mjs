// Extrai textos de interface (chaves pt-BR) do código-fonte para conferir o dicionário en-US.
import {readFile} from 'node:fs/promises';
const files=['src/App.tsx','src/Establishments.tsx','src/CsvImport.tsx','src/Editor.tsx','src/domain.ts','src/db.ts'];
const skip=/^(https?:|[a-z_]+$|[a-z]+[-_][a-z_-]+$|[A-Z]{2}$|\{\{|[a-z]+\/|[\d\W]+$|.*\.(csv|png)$)/;
export async function uiStrings(){
 const out=new Set();
 for(const file of files){
  const src=await readFile(file,'utf8');
  for(const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)){
   const v=m[1];if(!v||skip.test(v))continue;
   if(!/[A-Za-zÀ-ú]/.test(v))continue;
   if(!(/[À-ú]/.test(v)||/\s/.test(v)||/^[A-ZÀ-Ú]/.test(v)))continue;
   out.add(v.replace(/\\'/g,"'"));
  }
 }
 // Mensagens das triggers do banco também são exibidas ao usuário.
 for(const file of ['supabase/migrations/202610290001_initial.sql','supabase/migrations/202610290002_hardening.sql','supabase/migrations/202610290004_authorship.sql','supabase/migrations/202610290005_latest_evaluation.sql','supabase/migrations/202610290007_establishments_v11.sql','supabase/migrations/202610300009_access_log.sql']){
  for(const m of (await readFile(file,'utf8')).matchAll(/raise exception '([^']+)'/g))out.add(m[1]);
 }
 return [...out].sort();
}
if(import.meta.url===`file://${process.argv[1]}`)console.log((await uiStrings()).join('\n'));
