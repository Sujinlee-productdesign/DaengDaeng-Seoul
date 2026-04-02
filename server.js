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
// 1-3. 카라(KARA) 유기동물 스크래퍼
//      https://www.karma.or.kr 서울 지역, 강아지 필터링
//      city=0(서울), keyfield1=1(개) → 최신 10마리
// ----------------------------------------------------------------
app.get('/karma-animals', async (req, res) => {
  const BASE    = 'https://www.karma.or.kr';
  const HEADERS = {
    'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer':         BASE,
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9',
  };

  // HTML에서 &nbsp; 제거 + 태그 제거 + 공백 정리
  const clean = (s) => s.replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  // 한 페이지 HTML에서 동물 카드 파싱
  function parsePage(html) {
    const results = [];

    // ─── 카드 분리 ───────────────────────────────────────────────────
    // HTML 구조: <a href='#' img class='tx-animal-image' src='...' > ... </a> <ul> ... </ul> <button ...>
    // tx-animal-image 는 <a> 태그의 class 속성에 있음 (img 태그 아님)
    const sections = html.split(/(?=<a\b[^>]*class=['"][^'"]*tx-animal-image)/);

    for (const section of sections.slice(1)) {
      // ── 이미지 src (단따옴표 / 쌍따옴표 모두 처리) ─────────────────
      const imgM = section.match(/src=['"]?(\/human_DB\/files\/animal\/[^'">\s]+\.jpg)/i);
      if (!imgM) continue;
      const imgSrc = imgM[1];

      // ── aidx: ani_request 버튼 첫번째 인자 (좌측 0패딩 제거) ───────
      // <button onclick="ani_request('0000104599','2026-04-10',...)">
      const aidxM = section.match(/ani_request\(\s*['"]0*(\d+)['"]/);
      if (!aidxM) continue;
      const aidx = aidxM[1];

      // ── 필드 추출 헬퍼들 ─────────────────────────────────────────────
      // 패턴 A: <strong>라벨</strong> 다음줄 텍스트 (half li 방식)
      //   예: <strong>축종</strong>\n\t\t개 / Mix
      const fieldHalf = (label) => {
        const re = new RegExp(`<strong>\\s*${label}\\s*<\\/strong>([\\s\\S]{0,200}?)(?=<(?:strong|li|ul|button|div))`);
        const m  = section.match(re);
        return m ? clean(m[1]) : '';
      };

      // 패턴 B: <strong>라벨</strong> 다음 <i>값</i> (구조일)
      const fieldITag = (label) => {
        const re = new RegExp(`<strong>\\s*${label}\\s*<\\/strong>[\\s\\S]*?<i>([\\s\\S]*?)<\\/i>`);
        const m  = section.match(re);
        return m ? clean(m[1]) : '';
      };

      // 패턴 C: 라벨 li 다음 li의 텍스트 (구조장소, 특징)
      const fieldNextLi = (label) => {
        const re = new RegExp(`<strong>\\s*${label}\\s*<\\/strong>[\\s\\S]*?<\\/li>[\\s\\S]*?<li[^>]*>([\\s\\S]*?)<\\/li>`);
        const m  = section.match(re);
        return m ? clean(m[1]) : '';
      };

      // ── 각 필드 추출 ─────────────────────────────────────────────────
      // 구조일: <strong>구조일</strong><i>2026-03-31&nbsp;&nbsp;(SN:...)</i>
      const rescueDateRaw = fieldITag('구조일');
      const rescueDate    = rescueDateRaw.split(/\s/)[0]; // "2026-03-31"

      // 구조장소: 라벨 li 다음 li에 값
      const location  = fieldNextLi('구조장소');

      // half 필드들
      const speciesFull = fieldHalf('축종');       // "개 / Mix" | "개 / 말티즈"
      const sex         = fieldHalf('성별');        // "수컷" | "암컷" | "미상"
      const age         = fieldHalf('연령');        // "0년 02개월(추정)"
      const color       = fieldHalf('모색');        // "흰"
      const neuter      = fieldHalf('중성화수술');  // "했음" | "안 했음"
      const personality = fieldHalf('성격');        // "친화적"
      const weight      = fieldHalf('체중');        // "1.54 Kg"
      const health      = fieldHalf('건강상태');    // "양호"

      // 특징: <span>온순. 활발. ...</span> (다음 li 안의 span)
      const featureM = section.match(/<strong>\s*특징\s*<\/strong>[\s\S]*?<span>([\s\S]*?)<\/span>/);
      const feature  = featureM ? clean(featureM[1]) : '';

      // 입양 가능일: 버튼 텍스트 "YYYY-MM-DD부터 입양신청 가능"
      const adoptDateM = section.match(/(\d{4}-\d{2}-\d{2})부터 입양신청 가능/);
      const adoptDate  = adoptDateM ? adoptDateM[1] : '';

      // ── 파생 값 ──────────────────────────────────────────────────────
      const breedParts = speciesFull.split('/');
      const breed      = breedParts.length > 1 ? breedParts[1].trim() : (speciesFull || 'Mix');
      const sexCd      = sex.includes('수컷') ? 'M' : sex.includes('암컷') ? 'F' : 'Q';
      const neuterYn   = neuter.includes('안') ? 'N' : neuter.includes('했음') ? 'Y' : 'U';
      const today      = new Date().toISOString().slice(0, 10);
      const adoptOk    = !adoptDate || adoptDate <= today;

      results.push({
        aidx,
        popfile:      `${BASE}${imgSrc}`,
        kindCd:       breed || 'Mix',
        sexCd,
        neuterYn,
        age,
        color,
        weight,
        health,
        personality,
        feature,
        orgNm:        location,
        rescueDate,
        noticeEdt:    adoptDate,
        careNm:       '카라(KARA)',
        processState: adoptOk ? '입양가능' : '공고중',
        detailUrl:    `${BASE}/human_boardB/animal_request2.php?bid=adoption&act=write&aidx=${aidx}`,
      });
    }
    return results;
  }

  try {
    // 서울 지역 동물이 충분히 나오도록 1~2 페이지 동시 fetch
    const fetchPage = (page) => fetch(
      `${BASE}/human_boardA/animal_board.php?pagenow=${page}&keyfield1=1&keyfield2=0&city=0&country=&sch1=&sch2=&sch3=&bid=animal`,
      { headers: HEADERS }
    ).then(r => r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)));

    const [html1, html2] = await Promise.allSettled([fetchPage(1), fetchPage(2)]);

    const all = [
      ...(html1.status === 'fulfilled' ? parsePage(html1.value) : []),
      ...(html2.status === 'fulfilled' ? parsePage(html2.value) : []),
    ];

    // 서울 지역만 필터링 (구조장소에 "서울" 포함)
    const seoulOnly = all.filter(a => a.orgNm.includes('서울'));
    const animals   = seoulOnly.length >= 5 ? seoulOnly.slice(0, 15) : all.slice(0, 15);

    if (animals.length === 0) {
      return res.json({ animals: [], source: 'parse_failed' });
    }

    res.json({ animals, source: 'karma' });
  } catch (err) {
    console.error('karma 스크래퍼 오류:', err.message);
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
