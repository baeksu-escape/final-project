// N-10 메인 페이지 사진(AI로 생성한 이미지, 2560×1440) — src/assets/landing-<이름>.{webp,jpg,png}.
// Vite가 번들에 넣도록 import.meta.glob(eager)로 모듈처럼 불러온다(public/ 경로를 직접 쓰지 않는다 — 빌드 뒤 경로가 꼬이지 않게).
// 파일이 없으면 null을 돌려주고 화면은 색 배경으로 대신한다.
const FILES = import.meta.glob('../../assets/landing-*.{webp,jpg,jpeg,png}', { eager: true, import: 'default' })

export const photoOf = (name) => Object.entries(FILES).find(([path]) => new RegExp(`landing-${name}\\.(webp|jpe?g|png)$`).test(path))?.[1] ?? null

// 히어로 사진 두 장 — back: 버스 안 뒷모습(첫 화면), hand: 손에 든 폰(흰 액정). 파일 이름만 맞춰 넣으면 코드 수정 없이 바뀐다.
export const HERO_PHOTOS = {
  back: photoOf('bus-back'),
  hand: photoOf('bus-hand'),
}

// hand 사진 속 흰 액정 칸 위치는 landingCinema.css의 .cinema__screen에 있다(사진을 바꾸면 그 값을 다시 잰다).
