// ================================================================
// 댕댕서울 88 - Railway 배포용 서버
// Express로 정적 파일 서빙 + 서울 공공 API 프록시
// ================================================================

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000; // Railway가 PORT 환경변수 자동 주입

// ----------------------------------------------------------------
// 1. 서울 공공 API 프록시
//    브라우저에서 https → http API 직접 호출 시 Mixed Content 오류 발생
//    서버가 대신 http API를 호출하고 결과를 브라우저에 전달
// ----------------------------------------------------------------
app.get('/seoul-api/*', async (req, res) => {
  // /seoul-api/뒤의 경로를 그대로 서울 API에 전달
  const apiPath = req.params[0];
  const url = `http://openAPI.seoul.go.kr:8088/${apiPath}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('서울 API 프록시 오류:', err.message);
    res.status(502).json({ error: '서울 API 호출 실패' });
  }
});

// ----------------------------------------------------------------
// 2. 공공데이터포털 유기동물 API 프록시 (사진 포함)
//    출처: 농림축산식품부 동물보호관리시스템 (포인핸드 등 동일 소스)
//    환경변수: ADOPT_API_KEY (Railway Variables에서 설정)
//    미설정 시 빈 배열 반환 → 프론트 더미 fallback 처리
// ----------------------------------------------------------------
app.get('/adopt-api', async (req, res) => {
  const serviceKey = process.env.ADOPT_API_KEY;
  if (!serviceKey) {
    return res.json({ items: [] });
  }

  const params = new URLSearchParams({
    serviceKey,
    upkind:     '417000',  // 개
    upr_cd:     '6110000', // 서울특별시
    state:      'notice',  // 공고 중 (입양 가능)
    numOfRows:  '6',
    pageNo:     '1',
    _type:      'json',
  });

  const url = `https://apis.data.go.kr/1543061/abandonmentPublicService/abandonmentPublic?${params}`;

  try {
    const response = await fetch(url);
    const json     = await response.json();
    const items    = json?.response?.body?.items?.item ?? [];
    // 배열 보정 (결과 1개면 객체로 오는 경우 대비)
    res.json({ items: Array.isArray(items) ? items : [items] });
  } catch (err) {
    console.error('유기동물 API 프록시 오류:', err.message);
    res.json({ items: [] });
  }
});

// ----------------------------------------------------------------
// 3. Claude AI 챗봇 프록시
//    환경변수: CLAUDE_API_KEY (Railway Variables에서 설정)
//    /ai-chat POST → Anthropic API 호출 → 응답 반환
// ----------------------------------------------------------------
app.use(express.json()); // JSON body 파싱

app.post('/ai-chat', async (req, res) => {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ content: 'AI 서비스가 아직 설정되지 않았어요. 관리자에게 문의해주세요.' });
  }

  const { messages = [], systemOverride } = req.body;

  // 시스템 프롬프트: 댕댕서울 AI 산책 도우미 역할 설정
  const systemPrompt = `당신은 '댕댕서울 AI 산책 도우미'입니다.
서울에서 반려견과 산책하기 좋은 장소와 코스를 추천해주는 전문가예요.

주요 역할:
- 강아지 크기/견종/나이/건강 상태에 맞는 서울 산책 코스 추천
- 서울 구별 반려견 동반 가능 공원, 카페, 음식점 정보 제공
- 미세먼지·날씨에 따른 산책 팁 제공
- 반려견 에티켓과 안전 수칙 안내

답변 규칙:
- 항상 한국어로 답변하세요
- 구체적인 장소명과 위치(구/동)를 언급하세요
- 친근하고 따뜻한 말투를 사용하세요
- 답변은 간결하게 (300자 이내)
- 줄바꿈을 적절히 활용해 가독성 높게 작성하세요`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // 빠른 응답을 위해 Haiku 사용
        max_tokens: 512,
        system: systemOverride || systemPrompt, // 탭별 특화 프롬프트 지원
        messages: messages.slice(-10), // 최근 10개 메시지만 전송 (비용 절감)
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude API 오류:', errText);
      return res.status(502).json({ content: 'AI 응답을 받지 못했어요. 잠시 후 다시 시도해주세요.' });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '응답을 생성하지 못했어요.';
    res.json({ content });

  } catch (err) {
    console.error('AI 챗봇 프록시 오류:', err.message);
    res.status(502).json({ content: 'AI 서비스에 일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.' });
  }
});

// ----------------------------------------------------------------
// 4. 정적 파일 서빙 (HTML, CSS, JS, 이미지 등)
//    현재 폴더의 모든 파일을 그대로 제공
// ----------------------------------------------------------------
app.use(express.static(path.join(__dirname, '.')));

// ----------------------------------------------------------------
// 3. 서버 시작
// ----------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ 댕댕서울 88 서버 실행 중: http://localhost:${PORT}`);
});
