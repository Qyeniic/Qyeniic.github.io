# Qyeniic 포트폴리오

스크롤에 따라 3D 장면이 바뀌는 개인 포트폴리오 사이트입니다. React(Vite) + three.js로 만들었습니다.

사이트: https://qyeniic.github.io

## 구조
- `src/App.jsx`: 페이지 뼈대. 스크롤 구간(섹션)과 3D 무대를 마운트
- `src/components/Story.jsx`: 화면에 고정된 글자와 연락처 타일
- `src/scene/createScene.js`: three.js 3D 장면 (파티클 구 → 양자화 → 라즈베리파이 보드 → 3D 카드 → 연락처)
- `src/data/content.js`: 모든 문구, 카드 내용, 연락처 링크

## 실행
```bash
npm install
npm run dev      # 개발 서버
npm run build    # dist/ 에 배포용 파일 생성
```

`main` 브랜치에 push하면 GitHub Actions가 빌드해서 GitHub Pages에 배포합니다.
