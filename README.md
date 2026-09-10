# BokEum Archive

> Things I've built, explored, and learned.

GitHub, Vercel, Cloudflare, ChatGPT Site에 흩어진 프로젝트와 프롬프트·아이디어·실험을 한곳에서 찾기 위한 개인 빌드 아카이브입니다.

## 주요 기능

- `BokEumEom` GitHub 공개 저장소 자동 수집
- Projects / Prompts / Ideas / Experiments 분류
- GitHub / Vercel / Cloudflare / ChatGPT Site 출처 필터
- 제목·설명·태그·아이디어·프롬프트 통합 검색
- `type:prompt`, `source:cloudflare`, `tag:game` 검색 토큰
- Featured Projects와 최근 Build Timeline
- 프로젝트 상세에서 Idea → Prompt → Notes → Live → GitHub 연결
- Dark / Light 테마
- 외부 npm 의존성 없는 정적 웹앱

## 로컬 실행

```bash
python3 -m http.server 4173
```

브라우저에서 `http://localhost:4173`을 엽니다.

## 데이터 추가

`data/archive.json`의 `items` 배열에 항목을 추가합니다.

```json
{
  "id": "my-new-project",
  "type": "project",
  "title": "My New Project",
  "summary": "프로젝트 한 줄 설명",
  "date": "2026-09-10",
  "updated": "2026-09-10",
  "status": "live",
  "featured": false,
  "sources": ["vercel", "github"],
  "tags": ["ai", "web"],
  "liveUrl": "https://example.vercel.app",
  "githubRepo": "BokEumEom/example",
  "idea": "왜 만들었는지",
  "prompt": "사용했던 핵심 프롬프트",
  "notes": "만들면서 알게 된 것"
}
```

### type

`project`, `prompt`, `idea`, `experiment`

### sources

`github`, `vercel`, `cloudflare`, `chatgpt`, `manual`

## GitHub 자동 수집

브라우저에서 GitHub public API를 사용해 공개 저장소를 가져옵니다.

```text
https://api.github.com/users/BokEumEom/repos
```

`archive.json`에 같은 `githubRepo`가 존재하면 수동 데이터가 우선되므로 중복되지 않습니다.

## Vercel 배포

GitHub 저장소를 Vercel에 Import한 뒤 아래처럼 설정하면 됩니다.

- Framework Preset: `Other`
- Build Command: 비움
- Output Directory: `.`

## 다음 단계

1. Vercel / Cloudflare 프로젝트 자동 동기화
2. 배포 사이트 스크린샷 자동 생성
3. URL 입력만으로 프로젝트 메타데이터 생성
4. Prompt ↔ Project 양방향 연결
5. private admin mode
