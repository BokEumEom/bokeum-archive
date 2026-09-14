# BokEum Archive

> Things I've built, prompted & explored.

GitHub, Vercel, Cloudflare, ChatGPT Site에 흩어진 프로젝트와 프롬프트·아이디어·실험을 한곳에서 찾기 위한 개인 빌드 아카이브입니다.

## Stack

- React 19 + Vite 7
- GitHub public API project sync
- Vercel deployment + Serverless Function
- GitHub repository-backed Prompt Gallery

## 정보 구조

- **Sites** — 게임을 제외한 웹사이트, 앱, 대시보드, 도구
- **Games** — runner / RPG / arcade / puzzle / game 프로젝트를 별도 분리
- **Prompt Gallery** — 직접 선별한 이미지 + 실제 프롬프트만 게시
- **Ideas** — 아이디어와 실험 기록
- **`/admin`** — Prompt Gallery 수동 등록 화면

## Prompt Gallery 운영 방식

Library 자동 수집은 사용하지 않습니다. 좋은 결과물만 직접 선택해서 `/admin`에서 이미지와 프롬프트를 한 쌍으로 게시합니다.

1. `/admin` 접속
2. 원본 PNG / JPG / WebP 업로드
3. Title, Model, Category, Tags, Summary 입력
4. 실제 사용한 전체 Prompt 입력
5. Preview 확인 후 `Publish Prompt`
6. API가 원본 이미지를 `public/assets/gallery/`에 저장하고 `public/data/gallery.json`을 갱신
7. GitHub commit을 감지한 Vercel이 재배포하면 Gallery에 노출

브라우저에서 이미지 재압축을 하지 않습니다. Vercel Function 요청 크기를 고려해 직접 업로드는 3MB 이하를 권장합니다. 더 큰 원본은 GitHub에 직접 저장한 뒤 기존 항목을 편집해 해당 경로를 사용할 수 있습니다.

## Vercel 환경변수

`/admin` 게시 기능에는 다음 환경변수가 필요합니다.

```text
ADMIN_PASSWORD=<admin password>
GITHUB_TOKEN=<GitHub token with Contents read/write permission>
```

선택값:

```text
GITHUB_REPO=BokEumEom/bokeum-archive
GITHUB_BRANCH=main
```

`GITHUB_TOKEN`은 클라이언트 코드에 포함하지 않고 Vercel Function에서만 사용합니다.

## Local

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```
