const element=id=>document.getElementById(id);
const message=text=>{element('message').textContent=text;};
const authId=new URL(location.href).searchParams.get('authorization_id');
let client,details,email,approvedRedirect;
function checked(result){if(result.error)throw result.error;return result.data;}
async function busy(button,action){
  if(button.disabled)return;button.disabled=true;
  try{await action();}catch(error){message(error.message||'Unable to connect. Please try again.');}
  finally{button.disabled=false;}
}
export function consentRedirect(value,registeredCallback){
  const url=new URL(value),expected=new URL(registeredCallback);
  if(url.protocol!=='https:'||url.username||url.password||url.origin!==expected.origin||url.pathname!==expected.pathname)
    throw new Error('The connection returned an unexpected callback.');
  return url.href;
}
async function showAccount(){
  const {user}=checked(await client.auth.getUser());
  element('sign-in').hidden=Boolean(user);element('account').hidden=!user;
  element('verify-code').hidden=true;element('consent').hidden=true;approvedRedirect=null;
  if(!user){message('Enter your email to sign in.');return;}
  element('identity').textContent=user.email; element('owner-id').textContent=user.id;
  if(!authId){message('Signed in. Your account is ready for the remaining connection setup.');return;}
  if(!/^[A-Za-z0-9_-]{1,200}$/.test(authId))throw new Error('Invalid authorization request.');
  details=checked(await client.auth.oauth.getAuthorizationDetails(authId));
  // Supabase may return a previously approved redirect; require a user click to continue.
  if(details?.redirect_url){
    approvedRedirect=consentRedirect(details.redirect_url,details.redirect_url);
    element('client-name').textContent='Previously approved connection';
    element('client-id').textContent='';element('scopes').textContent='';
    element('callback').textContent='Returns to: '+new URL(approvedRedirect).origin;
    element('approve').textContent='Continue connection';element('deny').hidden=true;
    element('consent').hidden=false;message('This connection was previously approved. Continue to return to the application.');return;
  }
  if(!details?.client?.id||!details.redirect_uri)throw new Error('Restart the connection from ChatGPT to review its authorization request.');
  const callback=new URL(details.redirect_uri);
  if(callback.protocol!=='https:'||callback.username||callback.password)throw new Error('Unsupported connection callback.');
  element('client-name').textContent='Application: '+(details.client.name||'Unnamed application');
  element('client-id').textContent='Client ID: '+details.client.id;
  element('callback').textContent='Returns to: '+callback.href;
  element('scopes').textContent='Identity permissions: '+(details.scope||'email');
  element('approve').textContent='Allow connection';element('deny').hidden=false;
  element('consent').hidden=false;message('Review the application before allowing access.');
}
async function start(){
  const response=await fetch('./runtime-config.json',{cache:'no-store'});
  if(!response.ok)throw new Error('Raven configuration is unavailable.');
  const config=(await response.json()).mcpAuth;
  if(!config?.supabaseUrl||!config?.publishableKey||!globalThis.supabase)throw new Error('Sign-in is not configured.');
  client=globalThis.supabase.createClient(config.supabaseUrl,config.publishableKey,{auth:{persistSession:true,
    storage:sessionStorage,storageKey:'raven-mcp-consent',detectSessionInUrl:true}});
  element('sign-in').addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{
    email=element('email').value.trim();
    const emailRedirectTo=location.origin+location.pathname+(authId?'?authorization_id='+encodeURIComponent(authId):'');
    checked(await client.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo}}));
    element('verify-code').hidden=false;message('Check your email for a sign-in link or code. Open the link, or enter the code below.');
  });});
  element('verify-code').addEventListener('submit',event=>{event.preventDefault();busy(event.submitter,async()=>{
    checked(await client.auth.verifyOtp({email,token:element('code').value.trim(),type:'email'}));
    element('code').value='';await showAccount();
  });});
  element('sign-out').addEventListener('click',event=>busy(event.currentTarget,async()=>{
    checked(await client.auth.signOut());details=null;email=null;await showAccount();
  }));
  for(const [id,method] of [['approve','approveAuthorization'],['deny','denyAuthorization']])
    element(id).addEventListener('click',event=>busy(event.currentTarget,async()=>{
      if(approvedRedirect){location.assign(approvedRedirect);return;}
      const data=checked(await client.auth.oauth[method](authId,{skipBrowserRedirect:true}));
      location.assign(consentRedirect(data.redirect_url,details.redirect_uri));
    }));
  const {data,error}=await client.auth.getSession();if(error)throw error;
  if(data.session)await showAccount();else{element('sign-in').hidden=false;message('Enter your email to sign in.');}
}
start().catch(error=>message(error.message||'Sign-in is unavailable.'));
