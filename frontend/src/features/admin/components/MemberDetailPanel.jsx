import { useEffect, useRef } from 'react'
import { Button, Card, Chip, Notice } from '../../../common/components/index.js'
import { GRADE_LABELS } from '../../../common/config/grades.js'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'
import { ACCOUNT_STATUS_LABELS } from '../adminConstants.js'
import { EMPTY_TEXT, formatAmount, formatCount, formatDate, formatDateTime } from '../adminFormat.js'
import '../admin.css'

// ADM-08 creditProfile 값의 이름과 표시 방법 — 이름은 작업 7 백엔드 응답(데이터 입력 화면 creditProfile 섹션과 같은 이름)을 따른다.
// baseDate는 그 값의 기준일(USER_CREDIT_PROFILE.BASE_DATE)이다.
const CREDIT_PROFILE_FIELDS = [
  { key: 'baseDate', label: '기준일', format: formatDate },
  { key: 'delinquencyCount12m', label: '최근 12개월 연체(30일 이상)', format: (value) => formatCount(value, '회') },
  { key: 'cashAdvanceMonths', label: '현금서비스 이용 개월 수', format: (value) => formatCount(value, '개월') },
  { key: 'newLoanCount3m', label: '최근 3개월 신규 대출', format: (value) => formatCount(value, '건') },
  { key: 'privateLenderLoanBalanceAmount', label: '대부업 대출 잔액', format: formatAmount },
  { key: 'cardLimitAmount', label: '카드 한도', format: formatAmount },
  { key: 'cardMonthlySpendAmount', label: '카드 월 이용액', format: formatAmount },
]

// ADM-08 altDataSummary — 불러온 대안 데이터 개월 수.
const ALT_DATA_FIELDS = [
  { key: 'telecom', label: '통신비' },
  { key: 'utility', label: '공과금' },
  { key: 'easypay', label: '간편결제' },
  { key: 'nationalPension', label: '국민연금' },
  { key: 'healthInsurance', label: '건강보험' },
]

// 이름·값 목록(dl)을 그린다.
function DefinitionList({ rows }) {
  return (
    <dl className="admin-dl">
      {rows.map(([label, value]) => (
        <div key={label} className="admin-dl__row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

// FP-275 묶음 하나 — 제목 + 이름·값 목록(또는 없을 때 안내).
function DetailGroup({ title, children }) {
  return (
    <section className="admin-member-detail__group">
      <h3 className="admin-member-detail__title">{title}</h3>
      {children}
    </section>
  )
}

// N-35-1 회원 상세 패널 — 사유를 남기고 연 회원의 가린 기본 정보, 최근 평가, 카드·신용 값, 대안 데이터 개월 수를 보여 준다.
// FP-275 네 묶음을 2×2(900px 미만은 한 줄에 하나)로 놓고, 열 때마다 패널로 스크롤한다.
// 사용 예: <MemberDetailPanel detail={{ reason, data }} onClose={() => setDetail(null)} />   // data: ADM-08 응답
export default function MemberDetailPanel({ detail, onClose }) {
  const { reason, data } = detail
  const { profile, latestAssessment, creditProfile, altDataSummary } = data
  const panelRef = useRef(null)

  // 제목이 위쪽 고정 메뉴 줄(.app-header, 폭마다 높이가 다름)에 가리지 않게 그 높이만큼 띄워 스크롤한다.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const headerHeight = document.querySelector('.app-header')?.getBoundingClientRect().height ?? 0
    const top = panel.getBoundingClientRect().top + window.scrollY - headerHeight - 16
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' })
  }, [detail])

  return (
    <div ref={panelRef} className="admin-member-detail">
      <Card title={`회원 상세 · ${profile.loginId}`}>
        <Chip>열람 사유: {reason}</Chip>
        <Notice type="info">이 열람 기록은 열람 감사 로그에 남았습니다. 정보는 가린 값으로만 보여 줍니다.</Notice>
        <div className="admin-member-detail__groups">
          <DetailGroup title="기본 정보">
            <DefinitionList
              rows={[
                ['이름', profile.maskedName],
                ['이메일', profile.maskedEmail ?? EMPTY_TEXT],
                ['휴대폰', profile.maskedPhone ?? '등록 안 됨'],
                ['직군', JOB_TYPE_LABELS[profile.workerTypeCode] ?? EMPTY_TEXT],
                ['상태', ACCOUNT_STATUS_LABELS[profile.status] ?? profile.status],
                ['가입일', formatDate(profile.joinedAt)],
              ]}
            />
          </DetailGroup>

          <DetailGroup title="최근 평가">
            {latestAssessment ? (
              <DefinitionList
                rows={[
                  ['산출 일시', formatDateTime(latestAssessment.assessedAt)],
                  ['기존 점수', latestAssessment.tradScore ?? EMPTY_TEXT],
                  ['대안 점수', latestAssessment.altScore ?? EMPTY_TEXT],
                  ['대안 등급', GRADE_LABELS[latestAssessment.altGradeBandCode] ?? EMPTY_TEXT],
                  ['평가 번호', latestAssessment.requestId],
                ]}
              />
            ) : (
              <p className="hint">산출한 평가가 없습니다.</p>
            )}
          </DetailGroup>

          <DetailGroup title="카드·신용 정보">
            {creditProfile ? (
              <DefinitionList rows={CREDIT_PROFILE_FIELDS.map(({ key, label, format }) => [label, format(creditProfile[key])])} />
            ) : (
              <p className="hint">입력한 카드·신용 정보가 없습니다.</p>
            )}
          </DetailGroup>

          <DetailGroup title="대안 데이터 (불러온 개월 수)">
            <DefinitionList rows={ALT_DATA_FIELDS.map(({ key, label }) => [label, formatCount(altDataSummary?.[key], '개월')])} />
          </DetailGroup>
        </div>

        <Button onClick={onClose}>닫기</Button>
      </Card>
    </div>
  )
}
