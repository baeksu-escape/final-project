// N-16-1·N-20-4 상환 부담률을 함께 계산한다. 분모 0·미입력은 0%가 아니라 unavailable로 돌려준다.
export function calculateDsr(annualPaymentAmount, annualIncomeAmount) {
  if (!Number.isSafeInteger(annualPaymentAmount) || annualPaymentAmount < 0
    || !Number.isSafeInteger(annualIncomeAmount) || annualIncomeAmount <= 0) {
    return { value: null, risk: 'unavailable', unavailableReason: annualIncomeAmount === 0 ? 'income_zero' : 'income_missing' }
  }
  const value = annualPaymentAmount / annualIncomeAmount * 100
  return { value: Number.isFinite(value) ? value : null, risk: riskOf(value, ASSET_DEBT_RISK_THRESHOLDS.dsr), unavailableReason: null }
}

export const ASSET_DEBT_RISK_THRESHOLDS = Object.freeze({ dsr: { caution: 30, danger: 40 }, debtToAsset: { caution: 40, danger: 60 }, debtToNetAsset: { caution: 70, danger: 100 } })

// N-16-1·N-16-2 원 단위 입력으로 순자산·세 비율과 위험 단계를 계산한다. 분모가 유효하지 않으면 비율은 NULL이다.
export function calculateAssetDebt(baseline, changes = {}) {
  const data = { ...baseline, ...changes }
  const { totalAssetAmount, annualIncomeAmount, totalDebtAmount, annualPaymentAmount } = data
  const validMoney = (value) => Number.isSafeInteger(value) && value >= 0
  const totalNetAssetAmount = validMoney(totalAssetAmount) && validMoney(totalDebtAmount) ? totalAssetAmount - totalDebtAmount : null
  const dsr = calculateDsr(annualPaymentAmount, annualIncomeAmount)
  const debtToAsset = validMoney(totalDebtAmount) && validMoney(totalAssetAmount) && totalAssetAmount > 0
    ? totalDebtAmount / totalAssetAmount * 100 : null
  const debtToNetAsset = validMoney(totalDebtAmount) && totalNetAssetAmount > 0
    ? totalDebtAmount / totalNetAssetAmount * 100 : null
  const ratios = {
    dsr: { ...dsr, risk: dsr.value === null ? 'unavailable' : riskOf(dsr.value, ASSET_DEBT_RISK_THRESHOLDS.dsr), unavailableReason: dsr.value === null ? dsr.unavailableReason : null },
    debtToAsset: { value: finiteOrNull(debtToAsset), risk: debtToAsset === null ? 'unavailable' : riskOf(debtToAsset, ASSET_DEBT_RISK_THRESHOLDS.debtToAsset), unavailableReason: totalAssetAmount == null ? 'asset_missing' : totalDebtAmount == null ? 'debt_missing' : totalAssetAmount === 0 ? 'asset_zero' : null },
    debtToNetAsset: { value: finiteOrNull(debtToNetAsset), risk: debtToNetAsset === null ? 'unavailable' : riskOf(debtToNetAsset, ASSET_DEBT_RISK_THRESHOLDS.debtToNetAsset), unavailableReason: totalNetAssetAmount === null ? 'asset_or_debt_missing' : totalNetAssetAmount <= 0 ? 'net_asset_not_positive' : null },
  }
  return { totalAssetAmount: validMoney(totalAssetAmount) ? totalAssetAmount : null, annualIncomeAmount: validMoney(annualIncomeAmount) ? annualIncomeAmount : null,
    totalDebtAmount: validMoney(totalDebtAmount) ? totalDebtAmount : null, totalNetAssetAmount, annualPaymentAmount: validMoney(annualPaymentAmount) ? annualPaymentAmount : null, ratios,
    overallRisk: Object.values(ratios).some((ratio) => ratio.risk === 'danger') ? 'danger'
      : Object.values(ratios).some((ratio) => ratio.risk === 'caution') ? 'caution'
      : Object.values(ratios).every((ratio) => ratio.risk === 'safe') ? 'safe' : 'unavailable',
    assumptions: data.assumptions ?? [],
  }
}

function finiteOrNull(value) { return Number.isFinite(value) ? value : null }
function riskOf(value, thresholds) { return value >= thresholds.danger ? 'danger' : value >= thresholds.caution ? 'caution' : 'safe' }
