import "server-only";
export async function fetchAI(url:string, init:RequestInit, timeoutMs=20000, retries=1){
  let last: unknown;
  for(let n=0;n<=retries;n++){
    const c=new AbortController(); const t=setTimeout(()=>c.abort(),timeoutMs);
    try{
      const r=await fetch(url,{...init,signal:c.signal}); clearTimeout(t);
      if(r.ok)return r;
      const body=await r.text(); const low=body.toLowerCase();
      if(r.status===401||r.status===403)throw new Error("Invalid key");
      if(r.status===429)throw new Error("Quota exceeded");
      if(r.status===404||low.includes("model")&&low.includes("not found"))throw new Error("Model not found");
      if(r.status>=500&&n<retries){last=new Error("Provider temporarily unavailable");continue;}
      throw new Error("AI provider request failed");
    }catch(e){clearTimeout(t);last=e;if(n===retries)throw e;}
  }
  throw last;
}
