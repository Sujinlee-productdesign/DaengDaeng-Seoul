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
// 2. 정적 파일 서빙 (HTML, CSS, JS, 이미지 등)
//    현재 폴더의 모든 파일을 그대로 제공
// ----------------------------------------------------------------
app.use(express.static(path.join(__dirname, '.')));

// ----------------------------------------------------------------
// 3. 서버 시작
// ----------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ 댕댕서울 88 서버 실행 중: http://localhost:${PORT}`);
});
