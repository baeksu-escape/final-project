"""Pure transformations; callers supply randomness. No dataset generation or I/O."""
import numpy as np
from scipy.stats import norm, rankdata


def income_latent(debt, rho, normal_noise, tie_uniform):
    """Randomized distributional transform of empirical debt, including ties.

    A randomly selected row has a uniform transformed rank in the distributional
    model. Finite samples need not have exact normal moments. Constant debt has
    no association to model, so use the unscaled normal noise directly.
    """
    debt = np.asarray(debt, dtype=float)
    noise = np.asarray(normal_noise, dtype=float)
    tie = np.asarray(tie_uniform, dtype=float)
    if debt.ndim != 1 or len(debt) == 0 or noise.shape != debt.shape or tie.shape != debt.shape:
        raise ValueError('nonempty matching one-dimensional inputs required')
    if not -1 <= rho <= 1 or not np.isfinite(debt).all() or not np.isfinite(noise).all():
        raise ValueError('finite inputs and rho in [-1, 1] required')
    if not ((tie >= 0) & (tie < 1)).all():
        raise ValueError('tie uniforms must be in [0, 1)')
    if np.all(debt == debt[0]):
        return noise.copy()
    lower = rankdata(debt, method='min') - 1
    width = rankdata(debt, method='max') - lower
    u = (lower + tie * width) / len(debt)
    u = np.clip(u, np.finfo(float).eps, 1 - np.finfo(float).eps)
    return rho * norm.ppf(u) + np.sqrt(1 - rho**2) * noise


def allocate_card_components(single, installment, cash, available, weights):
    """Allocate customer/month amounts to open cards, preserving each component.

    Shapes: components (customers, months); available and weights
    (customers, cards, months). Amounts are thousand-KRW floating values.
    """
    available = np.asarray(available, dtype=bool)
    weights = np.asarray(weights, dtype=float)
    if weights.shape != available.shape or not np.isfinite(weights).all() or (weights < 0).any():
        raise ValueError('invalid card allocation weights')
    w = np.where(available, weights, 0.)
    den = w.sum(axis=1, keepdims=True)
    share = np.divide(w, den, out=np.zeros_like(w), where=den > 0)
    parts = []
    for component in (single, installment, cash):
        component = np.asarray(component, dtype=float)
        if component.shape != (available.shape[0], available.shape[2]) or not np.isfinite(component).all() or (component < 0).any():
            raise ValueError('invalid customer card component')
        if ((component > 0) & (den[:, 0, :] == 0)).any():
            raise ValueError('positive use without an allocatable open card')
        parts.append(component[:, None, :] * share)
    return tuple(parts)


def card_subsets(single, installment, cash, institution_ids):
    """Derive subsets and distinct cash-use institutions from account usage."""
    spend = single + installment + cash
    main = np.argmax(spend.sum(axis=2), axis=1)
    row = np.arange(len(spend))
    qualifying = spend[:, :, 0] >= 300
    main_parts = tuple(x[row, main, :] for x in (single, installment, cash))
    qual_parts = tuple(np.where(qualifying[:, :, None], x, 0).sum(axis=1)
                       for x in (single, installment, cash))
    institutions = np.array([len(np.unique(ids[used])) for ids, used in
                             zip(institution_ids, cash[:, :, 0] > 0)], dtype=np.int64)
    return main, qualifying, main_parts, qual_parts, institutions


def arrears_flags(utility_prob, telecom_base, telecom_given_utility, risk_flag, risk_multiplier, u_utility, u_telecom):
    """Person-level 'any late month in the year' flags for utility and telecom bills.

    Customers with a recent financial delinquency (risk_flag) are risk_multiplier times
    as likely to fall behind on bills (capped at 0.95). Telecom risk also rises with
    utility arrears, as in the original rule.
    """
    mult = np.where(np.asarray(risk_flag, bool), float(risk_multiplier), 1.0)
    p_util = np.minimum(np.asarray(utility_prob, float)*mult, .95)
    util = np.asarray(u_utility) < p_util
    p_tel = np.minimum((telecom_base + telecom_given_utility*util)*mult, .95)
    tel = np.asarray(u_telecom) < p_tel
    return util, tel, p_util, p_tel


def arrears_months(flags, months, persistence, u_start, u_continue):
    """Late-month matrix. A flagged person starts one late run in a uniformly chosen month;
    each following month stays late with probability `persistence` until the run ends."""
    flags = np.asarray(flags, bool)
    u_continue = np.asarray(u_continue)
    out = np.zeros((len(flags), months), dtype=int)
    start = np.minimum((np.asarray(u_start)*months).astype(int), months-1)
    for i in np.flatnonzero(flags):
        k = start[i]
        out[i, k] = 1
        k += 1
        while k < months and u_continue[i, k] < persistence:
            out[i, k] = 1
            k += 1
    return out
