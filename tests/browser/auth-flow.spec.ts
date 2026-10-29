import {test,expect} from '@playwright/test';
test('prévia não consome link; ativação exige clique explícito',async({page})=>{
 let calls=0;await page.route('https://crm-test.supabase.co/**',async route=>{if(route.request().url().includes('/functions/v1/activate-access'))calls++;await route.fulfill({status:410,contentType:'application/json',body:'{"error":"used"}'});});
 await page.goto('./#activation='+'A'.repeat(43));await expect(page.getByRole('heading',{name:'Ativar meu acesso'})).toBeVisible();expect(calls).toBe(0);await page.getByRole('button',{name:'Ativar e definir senha'}).click();await expect(page.getByRole('alert')).toContainText('usado ou revogado');expect(calls).toBe(1);
});
test('link expirado mostra erro em vez de cair silenciosamente no login',async({page})=>{
 await page.goto('./#error=access_denied&error_code=otp_expired&error_description=expired');await expect(page.getByRole('alert')).toContainText('já foi usado ou expirou');
});
