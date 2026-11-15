import { ALT_DATA_CONSENT_TYPE } from '../config/altDataSources.js'

// N-05-6·N-05-9 대안 데이터 mock 저장소 — 회원별 정보 제공 동의와 불러온 데이터를 메모리에 둔다(새로고침하면 사라진다).
// 다른 기능의 mock이 회원 데이터를 지울 때(FP-93 탈퇴)도 아래 함수를 쓴다. 동의 행은 DDL USER_CONSENT처럼 철회해도 지우지 않는다.
const consentsByUser = new Map() // userId → [동의 행]
const importedByUser = new Map() // userId → { [대안 데이터 key]: { importedAt, rows, consentId } }
let consentSequence = 0

// 동의 유효 기간(개월). DDL USER_CONSENT.EXPIRES_AT 주석의 "법적 최대 1년"을 따른다.
const CONSENT_VALID_MONTHS = 12

// 회원의 동의 이력(철회한 동의 포함)을 만든 순서대로 돌려준다.
export function listConsents(userId) {
  return consentsByUser.get(userId) ?? []
}

// 거두지 않았고 만료되지 않은 동의인지 본다.
export function isActiveConsent(consent) {
  return consent.withdrawnAt === null && new Date(consent.expiresAt) > new Date()
}

// 제공 기관·항목이 같은 유효한 동의를 찾는다. 없으면 undefined.
export function findActiveConsent(userId, { providerCode, itemCode }) {
  return listConsents(userId).find(
    (consent) => consent.providerCode === providerCode && consent.itemCode === itemCode && isActiveConsent(consent),
  )
}

// 동의 번호로 그 회원의 동의를 찾는다. 다른 회원의 동의는 찾지 않는다.
export function findConsentById(userId, consentId) {
  return listConsents(userId).find((consent) => consent.consentId === consentId)
}

// N-05-9 항목 하나에 동의한 행을 만든다. 필드는 DDL USER_CONSENT 열을 camelCase로 쓴다.
export function createConsent(userId, { providerCode, itemCode }) {
  consentSequence += 1
  const agreedAt = new Date()
  const expiresAt = new Date(agreedAt)
  expiresAt.setMonth(expiresAt.getMonth() + CONSENT_VALID_MONTHS)
  const consent = {
    consentId: consentSequence,
    consentTypeCode: ALT_DATA_CONSENT_TYPE,
    providerCode,
    itemCode,
    requiredYn: 'Y',
    agreedYn: 'Y',
    agreedAt: agreedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    withdrawnAt: null,
  }
  consentsByUser.set(userId, [...listConsents(userId), consent])
  return consent
}

// N-05-9 [연결 해제] — 동의 행에 withdrawnAt만 채우고, 그 동의로 불러온 데이터는 지운다(DDL v0.3.2 W1).
export function withdrawConsentOf(userId, consent) {
  consent.withdrawnAt = new Date().toISOString()
  const imported = importedByUser.get(userId) ?? {}
  importedByUser.set(
    userId,
    Object.fromEntries(Object.entries(imported).filter(([, data]) => data.consentId !== consent.consentId)),
  )
  return consent
}

// 회원이 불러온 대안 데이터를 종류별로 돌려준다.
export function getImportedAltData(userId) {
  return importedByUser.get(userId) ?? {}
}

// 불러온 대안 데이터 한 종류를 저장한다. 같은 종류를 다시 불러오면 덮어쓴다.
export function saveImportedAltData(userId, sourceKey, data) {
  importedByUser.set(userId, { ...getImportedAltData(userId), [sourceKey]: data })
}

// FP-93 회원 탈퇴 — 그 회원의 유효한 동의를 모두 거두고, 동의로 불러온 데이터를 모두 지운다. 동의 이력은 남긴다.
export function withdrawAllAltDataOfUser(userId) {
  listConsents(userId)
    .filter((consent) => consent.withdrawnAt === null)
    .forEach((consent) => withdrawConsentOf(userId, consent))
  importedByUser.delete(userId)
}
