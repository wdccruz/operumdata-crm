import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {en} from '../src/locales/en-US';
// @ts-ignore script JS sem tipos
import {uiStrings} from '../scripts/i18n-keys.mjs';
import {stages,qualifications,callResults,operationStages,criteria,commercialStatuses,operationalStatuses,importanceLevels,participantBands} from '../src/domain';
// Textos que não são interface (classes CSS, constantes técnicas) ou idênticos nos dois idiomas.
const notUi=new Set([' code-','N','PASSWORD_RECOVERY','T12:00:00','TEMPLATE','badge status-','chip active','metric ','metric metric-button ','sidebar open','English (US)','Português (Brasil)','PGRST202','PGRST205']);
describe('internacionalização en-US',()=>{
 it('todo texto de interface do código tem tradução',async()=>{const missing=(await uiStrings()).filter((k:string)=>!notUi.has(k)&&!(k in en));expect(missing).toEqual([])});
 it('toda chave usada em t() tem tradução',async()=>{const keys=new Set<string>();for(const file of ['src/App.tsx','src/Establishments.tsx','src/CsvImport.tsx','src/Editor.tsx','src/db.ts'])for(const m of (await readFile(file,'utf8')).matchAll(/\bt\('((?:[^'\\]|\\.)+)'/g))keys.add(m[1]);expect([...keys].filter(k=>!(k in en))).toEqual([])});
 it('valores fixos do banco são exibidos em inglês',()=>{const all=[...stages,...qualifications,...callResults,'Observação',...operationStages,...Object.values(criteria),...[commercialStatuses,operationalStatuses,importanceLevels].flat().map(([,l])=>l),...participantBands.filter(b=>/[a-zà-ú]/i.test(b)),'Agendada','Confirmada','Realizada','Ausência','Cancelada','Vídeo','Telefone','Presencial','Praxis','Estabelecimento','OperumData','Terceiros'];expect(all.filter(k=>!en[k])).toEqual([])});
 it('dicionário sem traduções vazias e com mesmas variáveis',()=>{for(const [k,v] of Object.entries(en)){expect(v.trim(),k).not.toBe('');expect((v.match(/\{\{\w+\}\}/g)||[]).sort(),k).toEqual((k.match(/\{\{\w+\}\}/g)||[]).sort())}});
});
