"""Independent reconciliation of saved outputs and label-leakage checks."""
from pathlib import Path
import argparse,json
import numpy as np
import pandas as pd
import yaml
from generate.extend import build, allocate
ROOT=Path(__file__).resolve().parents[1]

def main(source_path=None,report_dir=None):
    p=pd.read_csv(ROOT/'data/profiles.csv').set_index('customer_id')
    h=pd.read_csv(ROOT/'data/monthly_history.csv')
    b=pd.read_csv(ROOT/'data/base_207.csv',dtype={'HAC_CD':str})
    sums=h.groupby('customer_id')[['income_krw','expense_total_krw','debt_service_krw']].sum().loc[p.index]
    assert np.array_equal(sums.income_krw,p.annual_income_krw)
    assert np.array_equal(sums.debt_service_krw,p.annual_debt_service_krw)
    assert np.allclose(sums.expense_total_krw/sums.income_krw,p.expense_ratio)
    assert np.array_equal(h.net_cash_krw,h.income_krw-h.expense_total_krw-h.debt_service_krw)
    assert np.array_equal(p.debt_balance_krw,b.set_index('식별구분').loc[p.index].L00000002*1000)
    c=json.loads((ROOT/'extension_config.json').read_text());c['rows']=200
    prior=yaml.safe_load((ROOT/'reference/claude_config.yaml').read_text())
    a=build(b,c,prior);a2=build(b,c,prior)
    pd.testing.assert_frame_equal(a[1],a2[1]);pd.testing.assert_frame_equal(a[2],a2[2])
    changed=b.copy();changed['결과값(연체회차)']=12-changed['결과값(연체회차)']
    z=build(changed,c,prior)
    pd.testing.assert_frame_equal(a[1].drop(columns='label_any_delinquency_12m'),z[1].drop(columns='label_any_delinquency_12m'))
    pd.testing.assert_frame_equal(a[2],z[2])
    assert np.array_equal(allocate(np.array([0,1,17]),np.zeros((3,12))).sum(axis=1),[0,1,17])
    # Generation-seed sensitivity is reported, not used to adjust assumptions.
    rows=[]
    for seed in [20261029,20261030,20261031]:
        cc=dict(c,seed=seed,rows=len(b));_,pp,_,_,_=build(b,cc,prior)
        for s,g in pp.groupby('segment'):
            rows.append({'generation_seed':seed,'segment':s,'n':len(g),'mean_cv':g.income_cv.mean(),'median_monthly_income':g.annual_income_krw.median()/12,'mean_monthly_income':g.annual_income_krw.mean()/12})
    # Optional: compare saved base_207 with a supplied source CSV (the original file is not in the package).
    src_report='not_checked (no --source given)'
    if source_path is not None:
        codes={'식별구분':str,'HAC_CD':str,'RRC_CD':str,'INA_CD':str,'GOODS_CD':str}  # same typing as extend.py; avoids '7.50' vs '7.5' string mismatches
        src=pd.read_csv(source_path,dtype=codes).set_index('식별구분')
        mine=pd.read_csv(ROOT/'data/base_207.csv',dtype=codes).set_index('식별구분')
        pd.testing.assert_frame_equal(mine,src.loc[mine.index][mine.columns],check_exact=True)
        src_report=f'pass: {mine.shape[1]+1} columns including identifier x {len(mine)} rows identical to {Path(source_path).name}'
    cfgv=json.loads((ROOT/'extension_config.json').read_text())
    capv=p.annual_income_krw-p.annual_debt_service_krw+np.rint(cfgv['expense_drawdown_fraction']*p.liquid_assets_krw)
    assert ((sums.expense_total_krw<=capv)|(p.exceeds_drawdown_limit==1)).all()  # every customer is within the cap or explicitly flagged
    # Funding-shortfall flags recomputed from saved monthly data; flagged customers must be exactly those whose spending the cap could not hold.
    short=np.maximum(-h.groupby('customer_id').net_cash_krw.sum().loc[p.index],0)
    lim=np.rint(cfgv['expense_drawdown_fraction']*p.liquid_assets_krw)
    assert np.array_equal(short,p.annual_shortfall_krw)
    assert np.array_equal((short>lim).astype(int),p.exceeds_drawdown_limit)
    assert np.array_equal((short>p.liquid_assets_krw).astype(int),p.liquid_assets_insufficient)
    assert (sums.expense_total_krw[p.exceeds_drawdown_limit==1]<=cfgv['minimum_annual_living_expense_krw']).all()  # shortfall only where floor applied
    assert (p.liquid_assets_insufficient<=p.exceeds_drawdown_limit).all()
    # Month-end liquid balance recomputed independently from saved monthly net cash.
    hb=h.assign(bal=h.net_cash_krw.groupby(h.customer_id).cumsum()+h.customer_id.map(p.liquid_assets_krw))
    assert np.array_equal(hb.bal,h.liquid_balance_krw)
    g=hb.groupby('customer_id').bal
    assert np.array_equal(g.min().loc[p.index],p.min_liquid_balance_krw)
    assert np.array_equal(g.last().loc[p.index],p.ending_liquid_balance_krw)
    assert np.array_equal((hb.bal<0).groupby(hb.customer_id).sum().loc[p.index],p.months_liquid_negative)
    assert np.array_equal((p.ending_liquid_balance_krw<0).astype(int),p.liquid_assets_insufficient)  # ties to the shortfall flag
    assert (p.min_liquid_balance_krw<=p.ending_liquid_balance_krw).all()
    rho=p.annual_income_krw.corr(b.set_index('식별구분').loc[p.index].L00000002,method='spearman')
    assert rho>0.4, rho  # income-debt link at configured copula rho=0.5
    report={'expense_cap_within_or_flagged':'pass','shortfall_flags_recomputed':'pass','liquid_balance_recomputed':'pass','income_debt_spearman':round(float(rho),3),'source_fields_preserved':src_report,'saved_income_totals':'pass','saved_expense_ratio':'pass','saved_debt_service_totals':'pass','cashflow_identity':'pass','thousand_to_won_conversion':'pass','same_seed_reproducibility':'pass','target_changes_do_not_change_features':'pass','zero_weight_integer_allocation':'pass','generation_seeds':[20261029,20261030,20261031],'generation_sensitivity':rows}
    if report_dir is not None:
        report_dir=Path(report_dir);report_dir.mkdir(parents=True,exist_ok=True)
        csv_path=report_dir/'generation_sensitivity.csv';json_path=report_dir/'independent_checks.json'
        if csv_path.exists() or json_path.exists():raise FileExistsError('Report output already exists; choose a new --report-dir')
        pd.DataFrame(rows).to_csv(csv_path,index=False)
        json_path.write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Read-only checks; optional reports are written to a new directory outside the package.')
    parser.add_argument('--source',help='optional original CSV to compare with the saved base_207.csv')
    parser.add_argument('--report-dir',help='optional new directory for generated sensitivity CSV and JSON report')
    args=parser.parse_args();main(args.source,args.report_dir)
