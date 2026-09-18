export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

const STYLES = [
  {name:'감성형', direction:'warm emotional lifestyle photography, soft natural light, cozy premium cafe mood, elegant composition'},
  {name:'제품 강조형', direction:'clean commercial product photography, product is the clear hero, minimal background, crisp detail, premium studio-ad composition'},
  {name:'홍보형', direction:'bold attention-grabbing social media campaign visual, energetic composition, strong contrast and clear negative space for promotional copy'}
];

async function generateOne(key, image, base, style) {
  const prompt=`Create ONE polished square Korean small-business social media advertisement visual based on the uploaded photo.
Business name: ${base.name}
Business type: ${base.type}
Promotion facts: ${base.promo}
Requested mood: ${base.tone}
Design direction: ${style.name} — ${style.direction}.
Keep the main real product/store recognizable. Do not invent prices, discounts, logos, menu names, ingredients, claims, addresses, or offers. Do not replace factual details from the user's photo. Avoid generating Korean advertising sentences inside the image because exact copy will be overlaid separately by the app. Leave intentional clean space for headline text. Return a commercially usable 1:1 ad visual.`;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:'chat-latest',input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:image}]}],tools:[{type:'image_generation',quality:'low',size:'1024x1024'}]})});
  const data=await r.json();
  if(!r.ok) throw new Error(data?.error?.message||'이미지 생성 API 오류');
  const call=(data.output||[]).find(x=>x.type==='image_generation_call');
  if(!call?.result) throw new Error('생성된 이미지를 찾지 못했습니다.');
  return {style:style.name,image:'data:image/png;base64,'+call.result};
}

function clientIp(req){
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  return forwarded||String(req.headers['x-real-ip']||'unknown').trim();
}
async function kvCommand(command){
  const url=process.env.KV_REST_API_URL,token=process.env.KV_REST_API_TOKEN;
  if(!url||!token) throw new Error('무료 체험 저장소 연결이 필요합니다.');
  const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command)});
  const data=await r.json();if(!r.ok||data.error) throw new Error(data.error||'무료 체험 저장소 오류');return data.result;
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const key=process.env.OPENAI_API_KEY;
    if(!key) return res.status(500).json({error:'OPENAI_API_KEY missing'});
    const {name,type,promo,tone,image}=req.body||{};
    if(String(name||'').length>80||String(promo||'').length>1200||String(type||'').length>80||String(tone||'').length>80) return res.status(400).json({error:'입력 내용이 너무 깁니다.'});
    if(!name?.trim()||!promo?.trim()) return res.status(400).json({error:'가게 이름과 홍보 내용을 입력해주세요.'});
    if(!image?.startsWith('data:image/')) return res.status(400).json({error:'사진을 먼저 선택해주세요.'});
    if(image.length>5.6*1024*1024) return res.status(413).json({error:'업로드 이미지가 너무 큽니다.'});
    const allowed=['image/jpeg','image/png','image/webp'];const mime=image.slice(5,image.indexOf(';'));if(!allowed.includes(mime)) return res.status(415).json({error:'JPG, PNG, WEBP 이미지만 사용할 수 있습니다.'});
    const ip=clientIp(req);
    const trialKey='trial:ip:'+ip;
    const reservation=await kvCommand(['SET',trialKey,'pending','NX','EX','600']);
    if(reservation!=='OK') return res.status(403).json({error:'이 네트워크의 무료 체험 1회를 이미 사용했거나 현재 생성 중입니다. 정식 결제 기능은 준비 중입니다.'});
    const base={name:name.trim(),type:type||'기타',promo:promo.trim(),tone:tone||'깔끔한'};
    const ads=[];
    try{
      for(const style of STYLES) ads.push(await generateOne(key,image,base,style));
    }catch(err){
      try{await kvCommand(['DEL',trialKey])}catch{}
      throw err;
    }
    await kvCommand(['SET',trialKey,'used']);
    res.setHeader('Cache-Control','no-store');return res.status(200).json({ads});
  }catch(e){return res.status(500).json({error:e.message||'Server error'});}
}