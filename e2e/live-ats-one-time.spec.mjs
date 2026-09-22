import {test,expect} from "@playwright/test";

test.setTimeout(120000);

const cases=[
  {
    name:"Greenhouse",
    url:"https://job-boards.greenhouse.io/nex/jobs/5426435008",
    prepare:async(page)=>{ await page.waitForSelector('input[type="file"]',{timeout:30000}); }
  },
  {
    name:"Lever",
    url:"https://jobs.lever.co/cic/d28988a7-1ae5-4099-810a-ecf635ccf14e/apply",
    prepare:async(page)=>{ await page.waitForSelector('input[type="file"]',{timeout:30000}); }
  },
  {
    name:"Ashby",
    url:"https://jobs.ashbyhq.com/Terranova/20073074-c3b2-45f0-b264-9252b1cbff80",
    prepare:async(page)=>{
      const apply=page.getByText("Apply for this Job",{exact:true}).first();
      if(await apply.count()) await apply.click();
      await page.waitForSelector('input[type="file"]',{timeout:30000});
    }
  }
];

for(const site of cases){
  test(site.name+" live page accepts Raven's exact approved resume without submit",async({page})=>{
    const resume="data:application/pdf;base64,JVBERi0xLjQKUkFWRU4gQVBQUk9WRUQgUkVTVU1FCg==";
    const cover="data:application/pdf;base64,JVBERi0xLjQKUkFWRU4gQVBQUk9WRUQgQ09WRVIgTEVUVEVSCg==";
    await page.addInitScript(({url,resume,cover})=>{
      const store={
        ravenApplicationPacket:{
          version:1,
          createdAt:new Date().toISOString(),
          jobId:"live-synthetic-smoke",
          jobUrl:url,
          title:"Synthetic QA Role",
          company:"Raven QA",
          profile:{firstName:"Raven",lastName:"QA",email:"raven.qa@example.com"},
          answers:{},
          resume,
          coverLetter:cover
        }
      };
      globalThis.chrome={
        storage:{local:{
          get(keys,cb){const list=Array.isArray(keys)?keys:[keys];cb(Object.fromEntries(list.map(k=>[k,store[k]]).filter(([,v])=>v!==undefined)));},
          set(values,cb){Object.assign(store,values);cb?.();},
          remove(keys,cb){for(const k of (Array.isArray(keys)?keys:[keys])) delete store[k];cb?.();}
        }},
        runtime:{lastError:null,sendMessage(_m,cb){cb?.();}}
      };
    },{url:site.url,resume,cover});

    const submissions=[];
    page.on("request",request=>{
      if(request.method()==="POST" && /(?:greenhouse|lever|ashby)/i.test(request.url())) submissions.push(request.url());
    });

    await page.goto(site.url,{waitUntil:"domcontentloaded",timeout:60000});
    await site.prepare(page);
    await page.addScriptTag({path:"extension/src/assistant-core.js"});
    await page.addScriptTag({path:"extension/src/content.js"});

    await expect.poll(async()=>page.evaluate(()=>{
      const files=[...document.querySelectorAll('input[type="file"]')].flatMap(input=>[...(input.files||[])]);
      return files.length;
    }),{timeout:15000}).toBeGreaterThan(0);

    const attached=await page.evaluate(async()=>{
      const files=[...document.querySelectorAll('input[type="file"]')].flatMap(input=>[...(input.files||[])]);
      return Promise.all(files.map(async file=>({name:file.name,text:await file.text()})));
    });
    expect(attached.some(file=>file.text.includes("RAVEN APPROVED RESUME"))).toBe(true);
    expect(submissions).toEqual([]);
  });
}
