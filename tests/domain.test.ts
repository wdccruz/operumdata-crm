import {describe,it,expect} from 'vitest';
import {validCnpj,participantBand,possibleDuplicates,safeCsv,metrics,googleEvent} from '../src/domain';
const empty={companies:[],contacts:[],opportunities:[],activities:[],tasks:[],meetings:[],categories:[],buyers:[],campaigns:[],protocols:[],evaluations:[],contracts:[],operations:[],profiles:[],audit_log:[]};
describe('regras comerciais',()=>{
 it('valida CNPJ e permite ausência',()=>{expect(validCnpj('')).toBe(true);expect(validCnpj('12345678000195')).toBe(true);expect(validCnpj('11111111111111')).toBe(false);expect(validCnpj('12345678000199')).toBe(false)});
 it('classifica participantes e não empregados',()=>{expect([1,2,3,4,5,20,21,40,41].map(participantBand)).toEqual(['1–2','1–2','3–4','3–4','5–20','5–20','21–40','21–40','41 ou mais'])});
 it('detecta nome e telefone equivalentes',()=>{expect(possibleDuplicates([{id:'1',legal_name:'Empresa Sintética',phone:'(11) 99999-0000'}],{id:'2',legal_name:'empresa sintética'})).toHaveLength(1);expect(possibleDuplicates([{id:'1',phone:'(11) 99999-0000'}],{id:'2',phone:'11999990000'})).toHaveLength(1)});
 it('neutraliza fórmulas de planilha em exportação',()=>{expect(safeCsv('=IMPORTDATA()')).toBe("'=IMPORTDATA()");expect(safeCsv('+123')).toBe("'+123");expect(safeCsv('Empresa')).toBe('Empresa')});
 it('não apresenta projeções como resultados',()=>{expect(metrics(empty,new Set()).counts).toEqual(Array(12).fill(0));expect(metrics(empty,new Set()).conversion).toEqual(Array(6).fill('—'))});
 it('separa reunião, contrato e ativação',()=>{const s={...empty,opportunities:[{id:'1',created_at:'2026-10-29'}],meetings:[{opportunity_id:'1',starts_at:'2026-10-29',status:'Realizada'}],contracts:[{opportunity_id:'1',signed_on:'2026-10-29',signature_confirmed:true}],operations:[{opportunity_id:'1',status:'Implantação concluída'}]};const m=metrics(s,new Set(['1']));expect(m.counts[6]).toBe(1);expect(m.counts[7]).toBe(1);expect(m.counts[9]).toBe(0)});
 it('evento externo tem duração correta',()=>{expect(googleEvent({starts_at:'2026-10-29T12:00:00Z',duration_minutes:30},'Teste')).toContain('20261029T120000Z%2F20261029T123000Z')});
});
