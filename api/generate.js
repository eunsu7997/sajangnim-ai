export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { name, type, promo, tone } = req.body || {};
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY missing' });

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
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}