import { PATHS } from '../config/navigation.js'

// N-10 메인 아래 구간(LandingStory)의 서비스 목록 — 광고용 문구다(실제 고객 결과가 아니다).
// key는 폰 화면 카드 이름(LandingPhone의 CARDS), path는 [바로가기] 버튼이 여는 실제 기능 화면이다.
export const SERVICES = Object.freeze([
  {
    key: 'credit-report',
    label: '신용 점수',
    summary: '기존 모델과 대안 모델 점수를 나란히 보고, 어떤 기록이 점수를 움직였는지 확인해요.',
    cta: '신용 리포트',
    path: PATHS.REPORT,
  },
  {
    key: 'simulator',
    label: '신용 예측 시뮬레이터',
    summary: '카드 한도 사용률이나 연체 같은 조건을 바꾸면 예상 점수가 바로 계산돼요.',
    cta: '시뮬레이터',
    path: PATHS.SIMULATOR,
  },
  {
    key: 'asset-debt',
    label: '자산·부채 건전성',
    summary: '상환 부담률(DSR), 자산 대비 부채, 순자산 대비 부채를 계산해 안전·주의·위험으로 보여 줘요.',
    cta: '자산·부채 건전성',
    path: PATHS.ASSET_DEBT,
  },
  {
    key: 'alt-data',
    label: '대안 데이터 재료',
    summary: '통신비·공과금·국민연금·건강보험·간편결제 기록을 동의한 것만 불러와 점수의 재료로 써요.',
    cta: '대안 데이터',
    path: PATHS.DATA_INPUT,
  },
])
