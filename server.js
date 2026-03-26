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
