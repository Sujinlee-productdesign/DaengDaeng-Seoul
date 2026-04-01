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
// 1-2. 서울시 시립동물복지지원센터 입양 가능 반려견
//      1순위: 공공데이터포털 API + care_nm 필터 (ADOPT_API_KEY 필요)
//      2순위: animal.go.kr HTML 스크래핑 (API 키 불필요)
// ----------------------------------------------------------------
app.get('/shelter-animals', async (req, res) => {
  const CARE_NAMES = ['서울특별시동물복지지원센터', '서울시립동물복지지원센터', '서울시동물복지지원센터'];
  const BASE = 'https://www.animal.go.kr';

  // ── 1순위: 공공데이터포털 API (ADOPT_API_KEY가 있을 때만) ──
  const serviceKey = process.env.ADOPT_API_KEY;
  if (serviceKey) {
    try {
      const params = new URLSearchParams({
        serviceKey,
        upkind:    '417000',
        upr_cd:    '6110000',
        state:     'notice',
        numOfRows: '12',
        pageNo:    '1',
        _type:     'json',
      });
      const apiUrl  = `https://apis.data.go.kr/1543061/abandonmentPublicService/abandonmentPublic?${params}`;
      const apiResp = await fetch(apiUrl);
      const apiJson = await apiResp.json();
      let items     = apiJson?.response?.body?.items?.item ?? [];
      if (!Array.isArray(items)) items = [items];

      // 서울시 시립동물복지지원센터 소속만 필터
      const filtered = items.filter(it =>
        CARE_NAMES.some(n => (it.careNm || '').includes(n.slice(0, 8)))
      );
      const result = (filtered.length > 0 ? filtered : items).slice(0, 12);

      if (result.length > 0) {
        return res.json({ animals: result, source: 'api' });
      }
    } catch (apiErr) {
      console.warn('공공데이터 API 실패, 스크래핑 시도:', apiErr.message);
    }
  }

  // ── 2순위: animal.go.kr HTML 스크래핑 ──
  const listUrl = `${BASE}/front/awtis/public/publicList.do?searchState=notice&searchUprCd=6110000&searchUpkind=417000&pageNo=1&numOfRows=12`;

  try {
    const resp = await fetch(listUrl, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer':         BASE,
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();

    // desertionNo 전체 목록 추출 (global match로 중복 없이)
    const deserNos = [...html.matchAll(/desertionNo=(\d+)/g)].map(m => m[1]);
    const unique   = [...new Set(deserNos)].slice(0, 12);

    if (unique.length === 0) {
      return res.json({ animals: [], source: 'parse_failed' });
    }

    // 각 desertionNo 주변 HTML 블록에서 상세 정보 추출
    const animals = unique.map(desertionNo => {
      // desertionNo가 포함된 400자 컨텍스트 추출
      const idx   = html.indexOf(`desertionNo=${desertionNo}`);
      const start = Math.max(0, idx - 50);
      const end   = Math.min(html.length, idx + 600);
      const chunk = html.slice(start, end);

      const imgM    = chunk.match(/src="(\/front\/fileMng\/imageView\.do\?[^"]+)"/);
      const h3M     = chunk.match(/<h3[^>]*>\s*([^<]+?)\s*<\/h3>/);
      const h4M     = chunk.match(/<h4[^>]*>\s*([^<]+?)\s*<\/h4>/);

      // p 태그 텍스트 수집
      const paras = [];
      for (const m of chunk.matchAll(/<p[^>]*>\s*([^<]+?)\s*<\/p>/g)) {
        paras.push(m[1].trim());
      }

      const breed    = h3M ? h3M[1].trim() : '믹스견';
      const period   = h4M ? h4M[1].trim() : '';
      const location = paras.find(p => p.includes('발견') || p.includes('장소')) || '';
      const feature  = paras.find(p => p.includes('특징') || p.includes('kg') || p.includes('색상')) || '';

      const sexM    = feature.match(/수컷|암컷|미상/);
      const neuterM = feature.match(/중성화O|중성화X|중성화\s*(완료|미실시)/);
      const ageM    = feature.match(/(\d+)년생|(\d+)살|(\d+)개월/);

      return {
        desertionNo,
        popfile:      imgM ? `${BASE}${imgM[1]}` : null,
        kindCd:       breed,
        sexCd:        sexM ? (sexM[0] === '수컷' ? 'M' : sexM[0] === '암컷' ? 'F' : 'Q') : 'Q',
        neuterYn:     neuterM ? (neuterM[0].includes('O') || neuterM[0].includes('완료') ? 'Y' : 'N') : 'U',
        age:          ageM ? ageM[0] : '',
        noticeEdt:    period,
        careNm:       '서울시립동물복지지원센터',
        orgNm:        location.replace(/발견장소[:：]?\s*/, '').trim(),
        processState: '공고중',
      };
    });

    res.json({ animals, source: 'scraped' });
  } catch (err) {
    console.error('동물 스크래퍼 오류:', err.message);
    res.json({ animals: [], source: 'error', error: err.message });
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
    numOfRows:  '12',
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
// 1-1. 카카오 장소 상세 프록시 (CORS 우회 + 주차 정보 추출)
//      클라이언트에서 직접 호출 시 CORS 차단 → 서버가 대신 호출
// ----------------------------------------------------------------
app.get('/place-detail', async (req, res) => {
  const { id } = req.query;
  if (!id || !/^\d+$/.test(id)) return res.status(400).json({ error: 'invalid id' });

  try {
    const response = await fetch(`https://place.map.kakao.com/main/v/${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://map.kakao.com/',
        'Accept': 'application/json',
      },
    });
    if (!response.ok) return res.status(502).json({ parking: null });

    const data = await response.json();

    // 주차 정보 추출 (Kakao Place Detail 응답 구조)
    const basic   = data?.basicInfo || {};
    const parking = basic?.parking
                 || basic?.openHour?.parking
                 || data?.moreInfo?.parking
                 || null;

    // 주차 상태 판정
    let parkingStatus = null; // null = 정보 없음
    if (parking) {
      const parkStr = JSON.stringify(parking).toLowerCase();
      if (parkStr.includes('무료') || parkStr.includes('free')) {
        parkingStatus = 'free';
      } else if (parkStr.includes('유료') || parkStr.includes('가능') || parkStr.includes('있음') || parkStr.includes('주차장')) {
        parkingStatus = 'paid';
      } else if (parkStr.includes('불가') || parkStr.includes('없음') || parkStr.includes('no')) {
        parkingStatus = 'none';
      } else {
        parkingStatus = 'unknown';
      }
    }

    // 추가로 basicInfo.facilityInfo 확인
    const fac = basic?.facilityInfo;
    if (!parkingStatus && fac) {
      const facStr = JSON.stringify(fac).toLowerCase();
      if (facStr.includes('주차')) {
        parkingStatus = facStr.includes('무료') ? 'free' : 'paid';
      }
    }

    res.json({ parking: parkingStatus, raw: parking });
  } catch (err) {
    console.error('장소 상세 프록시 오류:', err.message);
    res.json({ parking: null });
  }
});

// ----------------------------------------------------------------
// 2-1. 이미지 프록시 (유기동물 사진 CORS 우회)
//      브라우저에서 www.animal.go.kr 이미지 직접 요청 시 CORS 차단됨
//      /img-proxy?url=... → 서버가 대신 이미지 fetch → 클라이언트에 전달
// ----------------------------------------------------------------
app.get('/img-proxy', async (req, res) => {
  const url = req.query.url;
  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).end();
  }
  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(502).end();
    const buf = await response.arrayBuffer();
    const ct  = response.headers.get('content-type') || 'image/jpeg';
    res.set('Content-Type', ct);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('이미지 프록시 오류:', err.message);
    res.status(502).end();
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
