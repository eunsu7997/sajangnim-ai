export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY missing' });
    const { name, type, promo, tone, image } = req.body || {};
    if (!image || !image.startsWith('data:image/')) return res.status(400).json({ error: '사진을 먼저 선택해주세요.' });

    const prompt = `Create a polished square social media advertisement based on the uploaded product/store photo.
Business name: ${name || '우리 가게'}
Business type: ${type || '기타'}
Promotion: ${promo || '오늘의 특별한 소식'}
Mood: ${tone || '깔끔한'}
Keep the main product/store recognizable. Improve lighting, composition and commercial appeal. Make it suitable for a Korean small-business Instagram advertisement. Do not invent logos, prices, discounts, or factual claims that were not provided. Avoid long text inside the image; leave clean visual space for copy.`;

    const r = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},
      body:JSON.stringify({
        model:'chat-latest',
        input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:image}]}],
        tools:[{type:'image_generation',quality:'low',size:'1024x1024'}]
      })
    });
    const data=await r.json();
    if(!r.ok) return res.status(r.status).json({error:data?.error?.message||'이미지 생성 API 오류'});
    const call=(data.output||[]).find(x=>x.type==='image_generation_call');
    const b64=call?.result;
    if(!b64) return res.status(500).json({error:'생성된 이미지를 찾지 못했습니다.'});
    return res.status(200).json({image:'data:image/png;base64,'+b64});
  } catch(e) { return res.status(500).json({error:e.message||'Server error'}); }
}