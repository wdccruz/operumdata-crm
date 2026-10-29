import {describe,it,expect} from 'vitest';
import {readAuthFlow} from '../src/auth-flow';
describe('links de ativação',()=>{
 it('lê segredo somente no fragmento, sem requisitar servidor',()=>{const url='https://wdccruz.github.io/operumdata-crm/#activation='+'A'.repeat(43);const r=readAuthFlow(url);expect(r.pending).toEqual({kind:'activation',token:'A'.repeat(43)});expect(new URL(url).search).toBe('')});
 it('reconhece o erro real otp_expired',()=>{const r=readAuthFlow('https://test.invalid/#error=access_denied&error_code=otp_expired&error_description=expired');expect(r.error).toContain('já foi usado ou expirou');expect(r.pending).toBe(null)});
 it('preserva recovery e invite anteriores',()=>{expect(readAuthFlow('https://test.invalid/#access_token=x&type=recovery').passwordFlow).toBe(true);expect(readAuthFlow('https://test.invalid/#token_hash=x&type=invite').pending?.kind).toBe('invite')});
});
