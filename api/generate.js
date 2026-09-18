async function kvCommand(command){
  const url=process.env.KV_REST_API_URL;
  const token=process.env.KV_REST_API_TOKEN;
  if(!url||!token) throw new Error('저장소 설정이 없습니다.');
  const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command)});
  const data=await r.json();
  if(!r.ok||data.error) throw new Error('저장소 요청에 실패했습니다.');
  return data.result;
}
function clientIp(req){
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  return forwarded||String(req.headers['x-real-ip']||'unknown').trim();
}
async function requestId(ip){
  const secret=process.env.KV_REST_API_TOKEN||'sajangnim-ai';
  const bytes=new TextEncoder().encode(secret+'|'+ip);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function checkRateLimit(req){
  const id=await requestId(clientIp(req));
  const bucket=Math.floor(Date.now()/60000);
  const key='rate:text:'+id+':'+bucket;
  const count=Number(await kvCommand(['INCR',key]));
  if(count===1) await kvCommand(['EXPIRE',key,'70']);
  return count<=5;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  try {
    let allowed;
    try{allowed=await checkRateLimit(req);}catch{return res.status(503).json({error:'요청 확인 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 이용해주세요.'});}
    if(!allowed) return res.status(429).json({error:'요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'});
    const { name, type, promo, tone } = req.body || {};
    if (!name?.trim() || !promo?.trim()) return res.status(400).json({ error: '가게 이름과 홍보 내용을 입력해주세요.' });
    if (name.length > 80 || promo.length > 1200 || String(tone||'').length > 80 || String(type||'').length > 80) return res.status(400).json({ error: '입력 내용이 너무 깁니다.' });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: '광고 문구 생성 서비스 설정을 확인 중입니다. 잠시 후 다시 이용해주세요.' });

    const prompt = [
      '너는 한국 소상공인용 광고 카피라이터다.',
      '과장광고를 피하고, 자연스럽고 짧은 한국어로 작성한다.',
      `가게 이름: ${name || '우리 가게'}`,
      `업종: ${type || '기타'}`,
      `홍보 내용: ${promo || '오늘의 특별한 소식'}`,
      `원하는 분위기: ${tone || '깔끔한'}`,
      '다음 JSON 형식만 반환해라:',
      '{"headline":"짧은 광고 제목","body":"2~3문장 홍보 문구","hashtags":["#태그1","#태그2","#태그3","#태그4"]}'
    ].join('\n');

    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: prompt,
        text: { format: { type: 'json_object' } }
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'OpenAI API error' });

    const text = data.output_text || data.output?.flatMap(x => x.content || []).find(x => x.type === 'output_text')?.text;
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { headline: '광고 문구 생성 완료', body: text || '', hashtags: [] }; }
    const safe={
      headline:String(parsed?.headline||'광고 문구 생성 완료').slice(0,120),
      body:String(parsed?.body||'').slice(0,1200),
      hashtags:Array.isArray(parsed?.hashtags)?parsed.hashtags.slice(0,12).map(x=>String(x).slice(0,60)):[]
    };
    return res.status(200).json(safe);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}