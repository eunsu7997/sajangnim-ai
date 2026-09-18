export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({ok:false});
  res.setHeader('Cache-Control','no-store');
  const url=process.env.KV_REST_API_URL,token=process.env.KV_REST_API_TOKEN;
  if(!url||!token) return res.status(500).json({ok:false,kv:false,error:'KV env missing'});
  try{
    const key='health:'+Date.now();
    const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
    const w=await fetch(url,{method:'POST',headers,body:JSON.stringify(['SET',key,'ok','EX','30'])});
    const wd=await w.json();if(!w.ok||wd.error) throw new Error(wd.error||'KV write failed');
    const g=await fetch(url,{method:'POST',headers,body:JSON.stringify(['GET',key])});
    const gd=await g.json();if(!g.ok||gd.error||gd.result!=='ok') throw new Error(gd.error||'KV read failed');
    return res.status(200).json({ok:true,kv:true,message:'KV read/write works'});
  }catch(e){return res.status(500).json({ok:false,kv:false,error:e.message})}
}