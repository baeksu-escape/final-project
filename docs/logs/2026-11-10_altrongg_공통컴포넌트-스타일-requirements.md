# 공통 컴포넌트 8개·공통 스타일 추가, FastAPI requirements.txt 작성

- **날짜:** 2026-11-10
- **작성자:** altrongg / Claude Code
- **브랜치:** `feature-B/common-components`
- **관련 N-ID:** 해당 없음 (공통 컴포넌트)
- **관련 결정:** 없음

## 무엇을, 왜 바꿨나
- 스타일 담당자 요청으로 'Avenue 기능 데모 v2' UI 기준의 공통 컴포넌트 8개와 공통 CSS를 추가했다. 기존 공통 컴포넌트 9개(작성자 JWC1226, 구두 허락)에는 코드 변경 없이 CSS만 입혔다.
- 저장소에 CSS 파일이 하나도 없어서 `common/styles/`를 새로 만들고 `main.jsx`에서 불러온다.
- `fastapi_server/requirements.txt`가 비어 있어서, 가상환경(Python 3.11.9)에 설치된 패키지 중 코드가 직접 쓰는 10개를 버전 고정으로 적었다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/common/components/{Button,Chip,Notice,ProgressBar,Switch,SegmentedControl,Modal,Toast}.jsx` | 새 공통 컴포넌트 8개 |
| `frontend/src/common/components/index.js` | 새 컴포넌트 export 8줄 추가 (기존 줄 변경 없음) |
| `frontend/src/common/styles/{tokens,forms,components}.css` | 색·글꼴 토큰(화이트/블랙), 기존 컴포넌트용 스타일, 새 컴포넌트용 스타일 |
| `frontend/src/main.jsx` | CSS import 3줄 추가 |
| `fastapi_server/requirements.txt` | 직접 쓰는 패키지 10개를 버전 고정으로 작성 |

## DB·API 변경
- DB: 없음
- API: 없음
- 영향을 받는 기능·팀원: 프론트 전체 화면의 바탕색·글꼴이 바뀐다(`body` 스타일 추가). 기존 공통 컴포넌트를 쓰는 로그인·데이터 입력 화면의 모양이 바뀐다. FastAPI 서버를 설치·실행하는 팀원은 `pip install -r requirements.txt`를 쓸 수 있다.

## 확인
- 확인함: `npm ci` 후 `npm run lint` 오류 없음.
- 확인 못 함: 화면 모양(`npm run dev`로 직접 확인 필요), 화이트/블랙 테마 전환(전환 코드는 만들지 않음), `requirements.txt`로 새 환경에 설치되는지.

## 다음 사람이 알아야 할 것
- 코드에 `import yaml`이 2곳(데이터 생성 쪽) 있지만 가상환경에 PyYAML이 없어 `requirements.txt`에 넣지 않았다. 필요 여부는 데이터 생성 담당이 정해야 한다.
- 데이터 생성용과 서버 실행용 패키지를 파일로 나눌지는 아직 정하지 않았다.
- Toast는 상태 훅 없이 `message`·`onClose`로 쓰는 쪽이 문구 상태를 관리한다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
