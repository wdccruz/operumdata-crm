export function readAuthFlow(href:string){
 const url=new URL(href),p=new URLSearchParams(url.hash.slice(1));
 const type=p.get('type');
 const tokenHash=p.get('token_hash');
 const activation=p.get('activation');
 const error=p.has('error')||p.has('error_description');
 return {
  passwordFlow:type==='invite'||type==='recovery',
  pending:activation?{kind:'activation' as const,token:activation}:tokenHash&&(type==='invite'||type==='recovery')?{kind:type,token:tokenHash}:null,
  error:error?'Este link é inválido, já foi usado ou expirou. Solicite um novo link ao administrador.':null
 };
}
export function clearAuthAddress(){history.replaceState(null,'',location.pathname);}
