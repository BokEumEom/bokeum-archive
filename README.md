# BokEum Archive

> Things I've built, prompted & explored.

GitHub, Vercel, Cloudflare, ChatGPT Site에 흩어진 프로젝트와 프롬프트·아이디어·실험을 한곳에서 찾기 위한 개인 빌드 아카이브입니다.

## Stack

- React 19
- Vite 7
- CSS only UI
- GitHub public API sync
- Vercel deployment

## 주요 화면

### Sites

실제로 만든 웹사이트, 앱, 게임, 실험을 결과 화면 중심으로 탐색합니다.

- GitHub 공개 저장소 자동 동기화
- Vercel / Cloudflare / ChatGPT Site / GitHub 필터
- 검색 및 정렬
- Live URL이 있는 사이트는 자동 screenshot preview 시도
- 상세 화면에서 Idea / Prompt / Notes / Live / GitHub 연결

### Prompt Gallery

Tripo / Mayz처럼 결과물을 먼저 보는 프롬프트 갤러리입니다.

- Image / Video / Web / 3D / Game / Research 필터
- 모델 배지
- Masonry gallery
- Prompt 복사
- 생성 결과 이미지 연결

Prompt preview 이미지는 `public/assets/prompts/`에 저장한 뒤 `public/data/archive.json`의 `preview`에 연결합니다.

```json
{
  "id": "prompt-example",
  "type": "prompt",
  "category": "image",
  "model": "ChatGPT Image",
  "title": "Example Prompt",
  "preview": "/assets/prompts/example.png",
  "prompt": "Create..."
}
```

## 로컬 실행

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## 데이터 관리

수동 아카이브 데이터는 다음 파일에서 관리합니다.

```text
public/data/archive.json
```

지원 type:

- `project`
- `prompt`
- `idea`
- `experiment`

지원 sources:

- `github`
- `vercel`
- `cloudflare`
- `chatgpt`
- `manual`

`githubRepo`가 같은 수동 항목이 있으면 GitHub 자동 수집 데이터보다 수동 데이터가 우선합니다.

## 프로젝트 구조

```text
bokeum-archive/
├── public/
│   └── data/
│       └── archive.json
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

## Vercel

Vercel에서 GitHub repository를 Import하면 Vite를 자동 감지할 수 있습니다.

현재 `vercel.json`은 다음 빌드 흐름을 사용합니다.

```text
npm run build → dist
```

별도 Environment Variable은 필요하지 않습니다.

## 다음 단계

1. 실제 Prompt 생성 이미지 아카이빙
2. Vercel / Cloudflare 프로젝트 API 동기화
3. Prompt ↔ Project 관계 연결
4. 프로젝트별 Build Log
5. private admin / editor mode
