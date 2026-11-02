"""v2.4: preserve academy labels; add assumption-based monthly histories linked to existing debt. No network."""
from pathlib import Path
import argparse, hashlib, json, platform
import numpy as np
import pandas as pd
import yaml
from generate.synthesis_logic import income_latent, arrears_flags, arrears_months

ROOT = Path(__file__).resolve().parents[1]

def allocate(total, weights):
    """Integer allocation preserving each row's exact annual total."""
    w = np.asarray(weights, dtype=float).copy()
    empty = w.sum(axis=1) == 0
    w[empty] = 1
    raw = total[:, None] * w / w.sum(axis=1, keepdims=True)
    out = np.floor(raw).astype(np.int64)
    remainder = total - out.sum(axis=1)
    order = np.argsort(-(raw-out), axis=1, kind='stable')
    for k in range(w.shape[1]):
        rows = np.flatnonzero(remainder > k)
        out[rows, order[rows, k]] += 1
    return out

def build(source, cfg, prior):
    seed = int(cfg['seed'])
    # Namespace 213 is reserved for extend.py; thinfile_engine.py uses 212.
    # build_thinfile.py passes the same seed to both, so the namespaces must differ.
    rng = np.random.default_rng(np.random.SeedSequence([seed, 213, 0]))
    tie_rng = np.random.default_rng(np.random.SeedSequence([seed, 213, 1]))
    eligible = source[source.HAC_CD.astype(str).isin(cfg['occupation_map'])]
    n = min(cfg['rows'], len(eligible)) if cfg['rows'] else len(eligible)
    base = eligible.sample(n=n, random_state=cfg['seed']).sort_values('식별구분').reset_index(drop=True)
    seg = base.HAC_CD.astype(str).map(cfg['occupation_map']).to_numpy()
    ids = base['식별구분'].to_numpy()
    m = cfg['history_months']
    assert m == 12, 'annual aggregation assumes twelve full months'
    mean = prior['stats']['wage_income_monthly_mean']['value'] * 10000
    median = prior['stats']['wage_income_monthly_median']['value'] * 10000
    sigma = np.sqrt(2*np.log(mean/median))
    income = np.zeros(n)
    age = np.zeros(n, dtype=int)
    groups = list(prior['age_groups'])
    # Age floor from the existing credit history (adult start at 19).
    history_days = base[['C00000090','L23003700']].max(axis=1).to_numpy()
    minimum_age = np.minimum(19 + np.ceil(history_days/365).astype(int), 69)
    ages = np.arange(20, 70)
    per_age = np.zeros(len(ages), dtype=int)
    for gi, g in enumerate(groups):
        per_age[(ages >= prior['age_groups'][g]['min']) & (ages <= prior['age_groups'][g]['max'])] = gi
    width = np.bincount(per_age)
    # Income uses a randomized debt-rank transform with explicit tie handling.
    # rho is a latent Gaussian mixing coefficient, not a guaranteed Spearman value.
    # Constant debt uses unscaled normal noise. Finite-sample marginals are approximate.
    rho = cfg['income_debt_copula_rho']
    debt_thousand = base.L00000002.to_numpy(dtype=float)
    for s, sc in prior['segments'].items():
        mask = seg == s
        count = mask.sum()
        if count == 0:
            continue
        sg = sigma if sc['income_sigma'] is None else sc['income_sigma']
        z = income_latent(debt_thousand[mask], rho, rng.standard_normal(count), tie_rng.random(count))
        income[mask] = 12*median*sc['income_median_mult']*np.exp(sg*z)
        # Age: segment age shares, truncated at the credit-history floor (no pile-up at the floor).
        share = np.asarray(sc['age_share'], dtype=float)/sum(sc['age_share'])
        w = np.tile((share/width)[per_age], (count, 1))
        w[ages[None, :] < minimum_age[mask][:, None]] = 0
        cum = w.cumsum(axis=1)
        u = rng.random(count)*cum[:, -1]
        age[mask] = ages[(cum < u[:, None]).sum(axis=1)]
    if cfg.get('age_by_customer') is not None:
        age = np.array([cfg['age_by_customer'][str(cid)] for cid in ids],dtype=int)
        if not ((age>=minimum_age)&(age<=69)).all():
            raise ValueError('explicit age incompatible with account history')
    if cfg.get('statistical_priors_enabled', False):
        stats = json.loads((ROOT/'reference/statistical_priors.json').read_text())
        # Reuse the copula latent value; only the wage age-conditional marginal changes.
        sc = prior['segments']['wage']
        old_sigma = sigma if sc['income_sigma'] is None else sc['income_sigma']
        for row in stats['wage']:
            mask = (seg == 'wage') & (age >= row['age_min']) & (age <= row['age_max'])
            latent = np.log(income[mask]/(12*median*sc['income_median_mult']))/old_sigma
            new_sigma = np.sqrt(2*np.log(row['mean_monthly_krw']/row['median_monthly_krw']))
            income[mask] = 12*row['median_monthly_krw']*np.exp(new_sigma*latent)
    annual = np.rint(income).astype(np.int64)
    si = np.array([cfg['monthly_sigma'][s] for s in seg])
    amp = np.array([cfg['season_amplitude'][s] for s in seg])
    phase = rng.uniform(0, 2*np.pi, n)
    weights = rng.lognormal(0, si[:,None], (n,m)) * (1+amp[:,None]*np.sin(2*np.pi*np.arange(m)/m+phase[:,None]))
    weights[rng.random((n,m)) < np.array([cfg['zero_income_month_probability'][s] for s in seg])[:,None]] = 0
    monthly_income = allocate(annual, weights)
    decile = pd.qcut(pd.Series(annual).rank(method='first'), 10, labels=False).to_numpy()+1
    ac = prior['alt']
    expense_ratio = np.array(ac['expense_ratio_by_decile'])[decile-1]*rng.lognormal(0, ac['expense_sigma'], n)
    service_annual = base.LRZ021201.to_numpy(dtype=np.int64)*1000
    service = allocate(service_annual, np.ones((n,m)))
    if cfg.get('service_by_customer') is not None:
        service = np.array([cfg['service_by_customer'][str(cid)] for cid in ids],dtype=np.int64)
        if service.shape!=(n,m) or (service<0).any():
            raise ValueError('invalid monthly debt-service budget')
        service_annual = service.sum(axis=1)
    assets = np.rint(annual*rng.lognormal(np.log(cfg['asset_to_income_log_median']),cfg['asset_to_income_log_sigma'],n)).astype(np.int64)
    liquid = np.rint(assets*rng.uniform(*cfg['liquid_asset_fraction'],n)).astype(np.int64)
    if cfg.get('statistical_priors_enabled', False):
        # Household ratios transferred via per-capita income anchors: explicit modeling assumption.
        anchors = stats['expense']
        ratio = np.interp(annual/12, [r['per_person_monthly_income'] for r in anchors],
                          [r['consumption_to_gross_income'] for r in anchors])
        noise = expense_ratio/np.array(ac['expense_ratio_by_decile'])[decile-1]
        expense_ratio = ratio*noise
        st = stats['assets']
        # Preserve the original random heterogeneity; match the mean ratio, not the median.
        heterogeneity = assets/annual/cfg['asset_to_income_log_median']
        heterogeneity /= np.exp(cfg['asset_to_income_log_sigma']**2/2)
        assets = np.rint(annual*(st['mean_assets_10k_krw']/st['mean_income_10k_krw'])*heterogeneity).astype(np.int64)
        liquid = np.rint(assets*(st['mean_savings_10k_krw']/st['mean_assets_10k_krw'])*cfg['accessible_savings_fraction']).astype(np.int64)
    raw_expense = np.rint(annual*expense_ratio).astype(np.int64)
    # Budget constraint (assumption): expense is capped at (income - debt service) + drawdown_fraction * liquid assets.
    # When even the cap is below the minimum living expense, spending is NOT cut below min(raw, floor); the customer
    # is then flagged (exceeds_drawdown_limit / liquid_assets_insufficient) instead of being passed as 'funded'.
    # The floor only limits how far the cap may cut spending; it does not raise low generated spending.
    drawdown_limit = np.rint(cfg['expense_drawdown_fraction']*liquid).astype(np.int64)
    cap = annual-service_annual + drawdown_limit  # may be negative: debt-service shortfall is NOT erased
    floor = cfg['minimum_annual_living_expense_krw']
    annual_expense = np.maximum(np.minimum(raw_expense, cap), np.minimum(raw_expense, floor)).astype(np.int64)
    annual_fixed = np.rint(annual_expense*cfg['fixed_expense_share']).astype(np.int64)
    fixed = allocate(annual_fixed, np.ones((n,m)))
    variable = allocate(annual_expense-annual_fixed, rng.lognormal(0,cfg['variable_expense_sigma'],(n,m)))
    expense = fixed+variable
    debt = base.L00000002.to_numpy(dtype=np.int64)*1000
    # Person-level incidence of any late month in the year. Recent financial delinquency
    # (SP or DQ1200001 in the 207-column source) raises bill-arrears risk; late runs can last
    # several months (persistence). Parameters and sources: reference/claude_config.yaml alt.*
    risk_flag = (base.SP.to_numpy() == 1) | (base.DQ1200001.to_numpy() > 0)
    util_flag, tel_flag, _, _ = arrears_flags(
        np.array(ac['utility_arrears_by_decile'])[decile-1], ac['telecom_base'], ac['telecom_given_utility'],
        risk_flag, ac['arrears_risk_multiplier'], rng.random(n), rng.random(n))
    utility_late = arrears_months(util_flag, m, ac['arrears_persistence'], rng.random(n), rng.random((n, m)))
    telecom_late = arrears_months(tel_flag, m, ac['arrears_persistence'], rng.random(n), rng.random((n, m)))
    net = monthly_income-expense-service
    shortfall = np.maximum(-net.sum(axis=1), 0)
    # Month-end liquid balance: opening liquid assets (assumed held at the start of the window) + cumulative net cash.
    # Negative = funds exhausted (unfunded). No interest/returns or other flows are modeled.
    balance = liquid[:, None] + np.cumsum(net, axis=1)
    cv = monthly_income.std(axis=1)/monthly_income.mean(axis=1)
    trailing = np.zeros(n,dtype=int)
    for j in range(n):
        for val in telecom_late[j,::-1]:
            if val: break
            trailing[j]+=1
    profiles = pd.DataFrame(dict(customer_id=ids,segment=seg,age=age,annual_income_krw=annual,
        debt_balance_krw=debt,annual_debt_service_krw=service_annual,asset_total_krw=assets,
        liquid_assets_krw=liquid,net_assets_krw=assets-debt,dsr=service_annual/annual,
        expense_ratio=expense.sum(axis=1)/annual,income_cv=cv,income_decile=decile,
        deficit_months=(net<0).sum(axis=1),zero_income_months=(monthly_income==0).sum(axis=1),
        worst_month_net_cash_krw=net.min(axis=1),annual_shortfall_krw=shortfall,ending_liquid_balance_krw=balance[:,-1],min_liquid_balance_krw=balance.min(axis=1),months_liquid_negative=(balance<0).sum(axis=1),shortfall_to_liquid_ratio=shortfall/liquid,
        exceeds_drawdown_limit=(shortfall>drawdown_limit).astype(int),liquid_assets_insufficient=(shortfall>liquid).astype(int),telecom_late_months=telecom_late.sum(axis=1),
        utility_late_months=utility_late.sum(axis=1),telecom_on_time_streak=trailing,
        label_any_delinquency_12m=(base['결과값(연체회차)'].to_numpy()>0).astype(int)))
    months = pd.period_range(cfg['history_start'],periods=m,freq='M').astype(str)
    history = pd.DataFrame(dict(customer_id=np.repeat(ids,m),month=np.tile(months,n),
        income_krw=monthly_income.ravel(),fixed_expense_krw=fixed.ravel(),variable_expense_krw=variable.ravel(),
        expense_total_krw=expense.ravel(),debt_service_krw=service.ravel(),net_cash_krw=net.ravel(),liquid_balance_krw=balance.ravel(),
        telecom_late=telecom_late.ravel(),utility_late=utility_late.ravel()))
    # A mechanical fixed-expense scenario, not a prediction of observed future income.
    stressed_income = np.rint(monthly_income*(1-cfg['stress_income_drop'])).astype(np.int64)
    stress_net = stressed_income-expense-service
    stress_balance = liquid[:, None] + np.cumsum(stress_net, axis=1)
    scenarios = pd.DataFrame(dict(customer_id=ids,scenario='income_minus_20pct_fixed_expenses',
        baseline_annual_net_cash_krw=net.sum(axis=1),scenario_annual_net_cash_krw=stress_net.sum(axis=1),
        baseline_min_liquid_balance_krw=balance.min(axis=1),scenario_min_liquid_balance_krw=stress_balance.min(axis=1),baseline_months_liquid_negative=(balance<0).sum(axis=1),scenario_months_liquid_negative=(stress_balance<0).sum(axis=1),
        baseline_dsr=service_annual/annual,scenario_dsr=service_annual/stressed_income.sum(axis=1)))
    checks = {
        'rows_selected':n,'eligible_rows':len(eligible),'excluded_other_occupation_rows':len(source)-len(eligible),
        'income_debt_spearman':float(pd.Series(annual).corr(pd.Series(base.L00000002.to_numpy()),method='spearman')) if base.L00000002.nunique()>1 and np.unique(annual).size>1 else None,
        'expense_capped_share':float((annual_expense<raw_expense).mean()),
        'exceeds_drawdown_limit_count':int((shortfall>drawdown_limit).sum()),'liquid_assets_insufficient_count':int((shortfall>liquid).sum()),
        'annual_expense_below_floor_count':int((annual_expense<cfg['minimum_annual_living_expense_krw']).sum()),
        'unique_customer_ids':bool(profiles.customer_id.is_unique),
        'age_consistent_with_existing_credit_history':bool((age>=minimum_age).all()),
        'twelve_months_per_customer':bool(history.groupby('customer_id').size().eq(12).all()),
        'history_keys_unique':bool(not history.duplicated(['customer_id','month']).any()),
        'income_reconciles':bool(np.array_equal(monthly_income.sum(axis=1),annual)),
        'expenses_reconcile':bool(np.array_equal(expense.sum(axis=1),annual_expense)),
        'service_reconciles':bool(np.array_equal(service.sum(axis=1),service_annual)),
        'original_label_preserved':bool(np.array_equal(profiles.label_any_delinquency_12m,(base['결과값(연체회차)']>0).astype(int))),
        'no_missing_values':bool(not profiles.isna().any().any() and not history.isna().any().any()),
        'liquid_balance_ties_to_shortfall':bool(np.array_equal(balance[:,-1]<0,shortfall>liquid)),
        'income_drop_never_raises_balance':bool((stress_balance<=balance).all()),
        'income_drop_never_increases_net_cash':bool((stress_net<=net).all()),
        'income_drop_never_decreases_dsr':bool((scenarios.scenario_dsr>=scenarios.baseline_dsr).all()),
        'telecom_annual_flags_reconcile':bool(np.array_equal(telecom_late.sum(axis=1)>0,tel_flag)),
        'money_units':'KRW; ratios 0..1 unless burden exceeds 1',
        'label_definition':'any delinquent month in virtual next 12 months; NOT default_90d_1y',
        'monthly_history':'2025-09..2026-08; newly simulated completed calendar months, not reconstructed transactions',
        'seed':cfg['seed'],
    }
    for key,value in checks.items():
        if isinstance(value,bool) and not value: raise AssertionError(key)
    return base,profiles,history,scenarios,checks

def main():
    a=argparse.ArgumentParser();a.add_argument('--input',required=True);a.add_argument('--rows',type=int);a.add_argument('--seed',type=int);a.add_argument('--out',default=str(ROOT/'data'));args=a.parse_args()
    cfg=json.loads((ROOT/'extension_config.json').read_text())
    if args.rows is not None:cfg['rows']=args.rows
    if args.seed is not None:cfg['seed']=args.seed
    if cfg['rows']<0:raise ValueError('rows must be nonnegative; 0 means all eligible rows')
    out=Path(args.out).resolve()
    prior=yaml.safe_load((ROOT/'reference/claude_config.yaml').read_text())
    source=pd.read_csv(args.input,dtype={'식별구분':str,'HAC_CD':str,'RRC_CD':str,'INA_CD':str,'GOODS_CD':str})
    base,p,h,s,c=build(source,cfg,prior)
    bundled=out/'base_207.csv'
    if out==(ROOT/'data').resolve() and bundled.exists() and len(base)!=sum(1 for _ in open(bundled,encoding='utf-8-sig'))-1:
        # data/base_207.csv is the bundled input; a subset run must not overwrite it with fewer rows.
        raise ValueError('row count differs from data/base_207.csv; write subset runs to a separate --out directory')
    out.mkdir(parents=True,exist_ok=True)
    for name,frame in [('base_207',base),('profiles',p),('monthly_history',h),('scenarios',s)]:frame.to_csv(out/f'{name}.csv',index=False,encoding='utf-8-sig')
    p.groupby('segment').agg(n=('customer_id','size'),mean_annual_income=('annual_income_krw','mean'),median_annual_income=('annual_income_krw','median'),mean_income_cv=('income_cv','mean'),label_rate=('label_any_delinquency_12m','mean')).to_csv(out/'segment_summary.csv',encoding='utf-8-sig')
    c['source_sha256']=hashlib.sha256(Path(args.input).read_bytes()).hexdigest()
    c['runtime']={'python':platform.python_version(),'numpy':np.__version__,'pandas':pd.__version__}
    (out/'validation.json').write_text(json.dumps(c,ensure_ascii=False,indent=2))
    (out/'effective_config.json').write_text(json.dumps(cfg,ensure_ascii=False,indent=2))
    print(json.dumps(c,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
