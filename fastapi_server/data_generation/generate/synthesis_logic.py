"""Pure transformations; callers supply randomness. No dataset generation or I/O."""
from decimal import Decimal, ROUND_HALF_UP, localcontext
import numpy as np
import pandas as pd
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


RATE_DECIMAL_PLACES = 4  # 금리 소수 자릿수(0.01%p 단위)


def quantize_rate(rate, places=RATE_DECIMAL_PLACES):
    """대출 금리를 소수 `places`자리로 ROUND_HALF_UP 고정해 float로 돌려준다.

    원장·상환 일정·더미 API·DB가 같은 금리를 쓰도록 원장에 내보내는 시점에만 쓴다.
    """
    step = Decimal(1).scaleb(-places)
    return float(Decimal(str(float(rate))).quantize(step, rounding=ROUND_HALF_UP))


def amortization_rows(balance, months, annual_rate, method):
    """상환방식(bullet·equal_payment·equal_principal)별 월 (원금, 이자) 목록을 돌려준다.

    이자는 월초 잔액 x 연금리/12를 원 단위 ROUND_HALF_UP하고, 마지막 달에 잔액이 정확히 0이 된다.
    """
    one = Decimal(1)
    annual = Decimal(str(annual_rate))
    rate = annual / 12
    n = int(months)
    bal = int(balance)
    if n < 1 or bal < 0:
        raise ValueError('months >= 1 and balance >= 0 required')
    if method not in ('bullet', 'equal_payment', 'equal_principal'):
        raise ValueError('unknown repayment method: ' + str(method))
    payment = 0
    if method == 'equal_payment':
        with localcontext() as ctx:
            ctx.prec = 60
            raw = Decimal(bal) / n if rate == 0 else Decimal(bal) * rate / (one - (one + rate) ** -n)
            payment = int(raw.quantize(one, rounding=ROUND_HALF_UP))
    q, rem = divmod(bal, n)
    rows = []
    for t in range(1, n + 1):
        interest = int((Decimal(bal) * annual / 12).quantize(one, rounding=ROUND_HALF_UP))
        if t == n:
            principal = bal
        elif method == 'bullet':
            principal = 0
        elif method == 'equal_principal':
            principal = q + (t <= rem)
        else:
            principal = min(max(payment - interest, 0), bal)
        rows.append((principal, interest))
        bal -= principal
    return rows


def inject_anomalies(frame, spec, rng):
    """전처리 시연용 결측·이상치를 표에 넣고 (오염된 표, 기록 표)를 돌려준다.

    종류·열마다 행 수 x 비율만큼 칸을 뽑고(한 칸에는 하나만), 원래 값과 넣은 값을 기록에 남긴다. 난수는 호출자가 준다.
    """
    out = frame.copy()
    used = {}
    log = []
    n_rows = len(out)
    for rule in spec['rules']:
        kind = rule['type']
        factor = rule.get('factor', {}).get('value')
        for col in rule['columns']:
            if not pd.api.types.is_integer_dtype(out[col]):
                raise ValueError('integer column required: ' + col)
            out[col] = out[col].astype('Int64')
            taken = used.setdefault(col, np.zeros(n_rows, dtype=bool))
            values = out[col]
            eligible = ~taken & values.notna().to_numpy()
            if kind != 'missing':
                eligible &= (values.fillna(0) != 0).to_numpy()
            pool = np.flatnonzero(eligible)
            count = int(n_rows * rule['rate']['value'] + 0.5)
            if count > len(pool):
                raise ValueError('not enough eligible cells: ' + kind + ' ' + col)
            for pos in np.sort(rng.choice(pool, size=count, replace=False)):
                original = int(values.iloc[pos])
                injected = None if kind == 'missing' else original * int(factor)
                out.iloc[pos, out.columns.get_loc(col)] = pd.NA if injected is None else injected
                taken[pos] = True
                log.append(dict(customer_id=out['customer_id'].iloc[pos], column=col, anomaly_type=kind,
                                original_value=original, injected_value=injected))
    log = pd.DataFrame(log, columns=['customer_id', 'column', 'anomaly_type', 'original_value', 'injected_value'])
    log[['original_value', 'injected_value']] = log[['original_value', 'injected_value']].astype('Int64')
    return out, log
