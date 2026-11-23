// 사이트에 들어가는 모든 글과 링크. 문구를 바꾸려면 이 파일만 고치면 된다.

export const profile = {
  name: 'Qyeniic',
  school: '한양대학교 컴퓨터소프트웨어학부',
  intro: [
    'Freshman in the Department of',
    'Computer Software at Hanyang University',
    'Studying On-device AI and Model',
    'Compression to prepare for AI graduate school.',
  ],
};

// 장면 2·3의 글자 (숫자 32 → 16 → 8 카운팅과 라벨 전환은 3D 코드가 처리)
export const scenes = {
  quant: { title: '양자화', bits: 32, label: '기존모델' },
  device: { title: '온디바이스 양자화', env: '모빌리티 환경', model: 'RT-DETR' },
};

// 3D 카드 7장: t = 제목(한 줄), s = 부연설명, b = 항목
export const cards = [
  { t: '온디바이스 양자화 연구', s: '자율주행 모델을 Raspberry Pi 4 위에서 돌리는 동아리 R&D 팀 연구 (조장)', b: ['주제 확정', '경량화 논문 리딩', 'End-to-End 구조 검토', 'Pi 4 배포 · 실측 (예정)'] },
  { t: '밑바닥부터 딥러닝', s: '라이브러리 전에 핵심 알고리즘을 직접 구현', b: ['NumPy 선형·로지스틱 회귀', '옵티마이저 5종 비교', 'MNIST CNN 약 94%', 'IMDB 감성 분석 RNN'] },
  { t: '버킷리스트 앱', s: 'Flutter와 Firebase로 만든 iOS 앱', b: ['Firebase 데이터 저장', '패키지 오류 추적·해결', 'FutureBuilder 비동기 표시'] },
  { t: '논문 리딩 & 정리', s: '핵심 논문을 한국어로 구조화해 정리', b: ['Attention Is All You Need', 'The Lottery Ticket Hypothesis'] },
  { t: '주력 기술', s: '가장 자신 있게 다루는 도구', b: ['Python · C', 'PyTorch · NumPy', 'Git / GitLab', 'Colab · VS Code'] },
  { t: '사용 경험 · 학습 중', s: '써 본 것과 지금 배우는 것', b: ['C++ · Dart · Flutter', 'Firebase · Pandas · Figma', 'Rust · Java · React', 'Raspberry Pi 4'] },
  { t: '총학생회 디자인국', s: 'Figma로 학생회 일정 캘린더 디자인 시스템 제작', b: ['Auto Layout · 컴포넌트', 'Variable Modes 색 관리', '행사 실무 참여'] },
];

// 연락처 타일. href가 null이면 그 타일은 숨겨진다.
export const contact = {
  email: 'mailto:sangbeomjeong695@gmail.com',
  github: 'https://github.com/Qyeniic',
  instagram: 'https://www.instagram.com/bummy_u/'
};
