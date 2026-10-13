import {test,expect} from '@playwright/test';
async function mockAuth(page,{signedIn=false,passwordError=false,redirect='https://chatgpt.com/connector/oauth/test?code=fixture',previous=false}={}){
 await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
 await page.addInitScript(({signedIn,redirect,previous,passwordError})=>{
  window.calls=[];let loggedIn=signedIn;
  const user={id:'fixture-owner',email:'owner@example.test'};
  const result=data=>Promise.resolve({data,error:null});
  window.supabase={createClient:()=>({auth:{
   getSession:()=>result({session:loggedIn?{}:null}),getUser:()=>result({user:loggedIn?user:null}),
   signInWithOtp:args=>{window.calls.push(['otp',args]);return result({});},
   signInWithPassword:()=>{window.calls.push(['password']);if(passwordError)return Promise.resolve({error:{message:'Invalid login credentials'}});loggedIn=true;return result({user});},
   updateUser:()=>{window.calls.push(['set-password']);return result({user});},
   verifyOtp:args=>{window.calls.push(['verify',args]);loggedIn=true;return result({user});},
   signOut:()=>{loggedIn=false;return result({});},
   oauth:{getAuthorizationDetails:()=>result(previous?{redirect_url:redirect}:{client:{id:'fixture-client',name:'<script>unsafe</script>'},
    redirect_uri:'https://chatgpt.com/connector/oauth/test',scope:'email'}),
    approveAuthorization:(id,options)=>{window.calls.push(['approve',id,options]);return result({redirect_url:redirect});},
    denyAuthorization:(id,options)=>{window.calls.push(['deny',id,options]);return result({redirect_url:redirect});}}
  }})};
 },{signedIn,redirect,previous,passwordError});
}
test('Raven consent requires a sign-in action and supports owner setup without a connection',async({page})=>{
 await mockAuth(page);await page.goto('/oauth-consent.html');
 await expect(page.getByRole('button',{name:'Email a sign-in link or code'})).toBeVisible();
 expect(await page.evaluate(()=>calls.length)).toBe(0);
 await page.getByLabel('Email',{exact:true}).fill('owner@example.test');
 await page.getByRole('button',{name:'Email a sign-in link or code'}).click();
 await page.getByLabel('Code from your email').fill('123456');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('#identity')).toHaveText('owner@example.test');
 await expect(page.locator('#consent')).toBeHidden();
 await page.getByText('Account setup identifier').click();await expect(page.locator('#owner-id')).toHaveText('fixture-owner');
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.locator('#account')).toBeHidden();
});
test('Raven password sign-in sends no email and preserves explicit OAuth consent',async({page})=>{
 await mockAuth(page);await page.goto('/oauth-consent.html?authorization_id=fixture-request');
 await expect(page.locator('#account')).toBeHidden();
 await page.getByLabel('Email',{exact:true}).fill('owner@example.test');
 await page.getByLabel('Password',{exact:true}).fill('synthetic-password-only');
 await page.getByRole('button',{name:'Sign in with password',exact:true}).click();
 await expect(page.locator('#consent')).toBeVisible();
 await expect(page.locator('#password')).toHaveValue('');
 expect(await page.evaluate(()=>calls)).toEqual([['password']]);
});
test('Raven failed password sign-in clears the field without sending email',async({page})=>{
 await mockAuth(page,{passwordError:true});await page.goto('/oauth-consent.html');
 await page.getByLabel('Email',{exact:true}).fill('owner@example.test');
 await page.getByLabel('Password',{exact:true}).fill('synthetic-password-only');
 await page.getByRole('button',{name:'Sign in with password',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('Invalid login credentials');
 await expect(page.locator('#password')).toHaveValue('');
 await expect(page.locator('#account')).toBeHidden();
 expect(await page.evaluate(()=>calls)).toEqual([['password']]);
});
test('Raven signed-in password setup checks confirmation and requires a save action',async({page})=>{
 await mockAuth(page,{signedIn:true});await page.goto('/oauth-consent.html?authorization_id=fixture-request');
 await page.getByText('Set password',{exact:true}).click();
 expect(await page.evaluate(()=>calls)).toEqual([]);
 await page.getByLabel('New password',{exact:true}).fill('synthetic-password-only');
 await page.getByLabel('Confirm password',{exact:true}).fill('different-password-only');
 await page.getByRole('button',{name:'Save password',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('The passwords do not match.');
 expect(await page.evaluate(()=>calls)).toEqual([]);
 await page.getByLabel('Confirm password',{exact:true}).fill('synthetic-password-only');
 await page.getByRole('button',{name:'Save password',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Password saved.');
 await expect(page.locator('#new-password')).toHaveValue('');
 await expect(page.locator('#confirm-password')).toHaveValue('');
 await expect(page.locator('#consent')).toBeVisible();
 expect(await page.evaluate(()=>calls)).toEqual([['set-password']]);
});
test('Raven consent escapes client metadata and requires an explicit approval with validated callback',async({page})=>{
 await mockAuth(page,{signedIn:true,redirect:'https://attacker.test/callback'});
 await page.goto('/oauth-consent.html?authorization_id=fixture-request');
 await expect(page.locator('#client-name')).toHaveText('Application: <script>unsafe</script>');
 expect(await page.evaluate(()=>calls.length)).toBe(0);
 await page.getByRole('button',{name:'Allow connection'}).click();
 await expect(page.getByRole('status')).toHaveText('The connection returned an unexpected callback.');
 expect(page.url()).toContain('oauth-consent.html');
 expect(await page.evaluate(()=>calls[0])).toEqual(['approve','fixture-request',{skipBrowserRedirect:true}]);
});
test('Raven previously approved consent still waits for a user action',async({page})=>{
 await mockAuth(page,{signedIn:true,previous:true});await page.goto('/oauth-consent.html?authorization_id=fixture-request');
 await expect(page.getByRole('button',{name:'Continue connection'})).toBeVisible();
 expect(page.url()).toContain('oauth-consent.html');expect(await page.evaluate(()=>calls.length)).toBe(0);
 await expect(page.getByRole('button',{name:'Deny connection'})).toBeHidden();
});
test('Raven consent loads the pinned auth SDK and fits a mobile viewport',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/oauth-consent.html');
 await expect(page.getByRole('button',{name:'Email a sign-in link or code'})).toBeVisible();
 expect(await page.evaluate(()=>typeof window.supabase?.createClient)).toBe('function');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/oauth-consent-mobile.png',fullPage:true});
});
