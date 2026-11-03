"""Pure functions for the nonfinancial-effect label. No file IO, no generator calls.

logit_i = a + base_logit_i + log(OR) * bill_arrears_i + gamma * cashflow_z_i + extra_i
extra_i (v3.5.0) = log(OR_si) * social_insurance_arrears_i + delta * payment_regularity_z_i
base_logit: logistic model of the ORIGINAL label on financial 207-column features.
a: shifted so the mean probability equals the original positive rate.
Because base_logit enters as an offset, OR is the odds ratio *given* financial risk.
"""
import numpy as np
from scipy.special import expit
from sklearn.linear_model import LogisticRegression


def financial_matrix(frame, features, log1p_features):
    x = frame[features].astype(float).copy()
    for c in log1p_features:
        x[c] = np.log1p(x[c].clip(lower=0))
    x = x.fillna(x.median())
    return ((x - x.mean()) / x.std(ddof=0).replace(0, 1)).to_numpy()


def base_logit(x, y, fit_mask=None):
    fit_mask = np.ones(len(y), bool) if fit_mask is None else np.asarray(fit_mask, bool)
    model = LogisticRegression(max_iter=2000).fit(x[fit_mask], np.asarray(y)[fit_mask])
    return model.decision_function(x)


def cashflow_z(months_liquid_negative, income_cv):
    def z(v):
        v = np.asarray(v, float)
        s = v.std()
        return (v - v.mean()) / s if s > 0 else np.zeros_like(v)
    return (z(months_liquid_negative) + z(income_cv)) / 2


def payment_regularity_z(active_months, ever_used):
    """Standardized active payment months among ever-users; 0 (neutral) for never-users.
    No payment history is treated as no information, not as bad behaviour."""
    m = np.asarray(active_months, float)
    users = np.asarray(ever_used, bool)
    out = np.zeros_like(m)
    if users.sum() > 1:
        mu, sd = m[users].mean(), m[users].std()
        out[users] = (m[users] - mu) / sd if sd > 0 else 0.0
    return out


def calibrate_intercept(logit, target_rate, lo=-30.0, hi=30.0, tol=1e-10):
    if not 0 < target_rate < 1:
        raise ValueError('target_rate must be in (0, 1)')
    for _ in range(200):
        mid = (lo + hi) / 2
        if expit(logit + mid).mean() < target_rate:
            lo = mid
        else:
            hi = mid
        if hi - lo < tol:
            break
    return (lo + hi) / 2


def effect_probability(base, bill_arrears, cf_z, odds_ratio, gamma, target_rate, mask=None, extra_logit=None):
    """Design probability. `mask` = customers eligible for a positive label (e.g. future credit exposure).
    `extra_logit` adds further conditional effects (v3.5.0: social insurance arrears, payment regularity)."""
    mask = np.ones(len(base), bool) if mask is None else np.asarray(mask, bool)
    logit = np.asarray(base, float) + np.log(odds_ratio) * np.asarray(bill_arrears, float) + gamma * np.asarray(cf_z, float)
    if extra_logit is not None:
        logit = logit + np.asarray(extra_logit, float)
    a = calibrate_intercept(logit[mask], target_rate)
    return np.where(mask, expit(logit + a), 0.0)


def draw_labels(prob, uniform):
    return (np.asarray(uniform) < np.asarray(prob)).astype(int)


def mantel_haenszel_or(y, exposed, strata):
    """Odds ratio of `exposed` adjusted for `strata` (used to check the conditional OR)."""
    num = den = 0.0
    for s in np.unique(strata):
        k = strata == s
        a = np.sum(k & (exposed == 1) & (y == 1)); b = np.sum(k & (exposed == 1) & (y == 0))
        c = np.sum(k & (exposed == 0) & (y == 1)); d = np.sum(k & (exposed == 0) & (y == 0))
        n = a + b + c + d
        if n:
            num += a * d / n; den += b * c / n
    return num / den if den else np.nan
