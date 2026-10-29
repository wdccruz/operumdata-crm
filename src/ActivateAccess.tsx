import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {Session} from '@supabase/supabase-js';
import {db} from './db';
import {clearAuthAddress,readAuthFlow} from './auth-flow';
type Pending=NonNullable<ReturnType<typeof readAuthFlow>['pending']>;
export function ActivateAccess({pending,onSuccess,onCancel}:{pending:Pending;onSuccess:(session:Session)=>void;onCancel:()=>void}){
 const{t}=useTranslation();const[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function activate(){
  if(busy)return;setBusy(true);setError('');
  try{
   let session:Session|null=null;
   if(pending.kind==='activation'){
    const response=await db.functions.invoke('activate-access',{body:{token:pending.token}});
    if(response.error||response.data?.error)throw new Error('activation_failed');
    const result=await db.auth.setSession(response.data.session);
    if(result.error)throw result.error;session=result.data.session;
   }else{
    const result=await db.auth.verifyOtp({token_hash:pending.token,type:pending.kind});
    if(result.error)throw result.error;session=result.data.session;
   }
   if(!session)throw new Error('missing_session');
   clearAuthAddress();onSuccess(session);
  }catch{setError(t('Não foi possível ativar este link. Ele pode já ter sido usado ou revogado. Solicite um novo link ao administrador.'));}
  finally{setBusy(false)}
 }
 return <div className="setup"><div className="wordmark">OPERUM<span>DATA</span></div><h1>{t('Ativar meu acesso')}</h1><p>{t('Clique abaixo para ativar seu acesso e definir sua senha. Abrir esta página não utiliza o link.')}</p>{error&&<p className="error" role="alert">{error}</p>}<div className="actions"><button className="primary" disabled={busy} onClick={()=>void activate()}>{busy?t('Ativando…'):t('Ativar e definir senha')}</button><button disabled={busy} onClick={()=>{clearAuthAddress();onCancel()}}>{t('Cancelar')}</button></div></div>;
}
