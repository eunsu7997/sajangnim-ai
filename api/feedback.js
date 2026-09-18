async function kvCommand(command){
  const url=process.env.KV_REST_API_URL,token=process.env.KV_REST_API_TOKEN;
  if(!url||!token) throw new Error('storage');
  const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command)});
  const data=await r.json();
  if(!r.ok||data.error) throw new Error('storage');
  return data.result;
}
function clean(v,n=500){return String(v||'').trim().slice(0,n)}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
  try{
    const {kind,text,intent,product}=req.body||{};
    if(kind==='feedback'){
      const value=clean(text);
      if(!value)return res.status(400).json({error:'피드백 내용을 입력해주세요.'});
      const id=crypto.randomUUID();
      await kvCommand(['SET','feedback:'+id,JSON.stringify({kind:'feedback',text:value,at:new Date().toISOString()}),'EX','7776000']);
      return res.status(201).json({ok:true});
    }
    if(kind==='research'){
      const i=clean(intent,100),p=clean(product,120);
      if(!i||!p)return res.status(400).json({error:'구매 의향과 원하는 상품을 선택해주세요.'});
      const id=crypto.randomUUID();
      await kvCommand(['SET','feedback:'+id,JSON.stringify({kind:'research',intent:i,product:p,at:new Date().toISOString()}),'EX','7776000']);
      return res.status(201).json({ok:true});
    }
    return res.status(400).json({error:'지원하지 않는 요청입니다.'});
  }catch(e){
    return res.status(503).json({error:'피드백 저장 서비스에 일시적인 문제가 있습니다.'});
  }
}