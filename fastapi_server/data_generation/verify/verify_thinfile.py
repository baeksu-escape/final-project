"""Independent saved-ledger checks and deterministic replay for the new cohort."""
from pathlib import Path
import json,tempfile,hashlib
import numpy as np,pandas as pd
from generate.build_thinfile import run
from verify.verify_card_accounts import validate as validate_card_accounts
R=Path(__file__).resolve().parents[1];D=R/'thinfile'
# Only explicitly declared continuous fields permit floating-point tolerance.
RATE_COLUMNS={c['column'] for c in json.loads((R/'reference/academy/schema.json').read_text())['columns'] if c['data_type']=='double' and c['unit'] in ('%', '연 %')}
FLOAT_COLUMNS={
 'base_207': RATE_COLUMNS,
 'profiles': {'dsr','expense_ratio','income_cv','shortfall_to_liquid_ratio','snapshot_dsr'},
 'scenarios': {'baseline_dsr','scenario_dsr'},
 'loans': {'annual_rate'},
 'model_inputs': {'CL0631905','expense_ratio','dsr','income_cv'},
 'target_metadata': {'target_design_probability'},
 'card_account_monthly': {'spend_thousand','single_thousand','installment_thousand','cash_thousand'},
}
def assert_reproduced(name, left, right):
 """Keep order, dtypes and missingness; unknown columns default to exact."""
 assert list(left.columns)==list(right.columns), 'column order/schema mismatch'
 assert left.shape==right.shape, 'shape mismatch'
 for col in left.columns:
  pd.testing.assert_series_equal(left[col], right[col], check_exact=col not in FLOAT_COLUMNS.get(name,set()), rtol=1e-9, atol=0)

def main():
 read=lambda name:pd.read_csv(D/f'{name}.csv')
 b=read('base_207').set_index('식별구분');p=read('profiles').set_index('customer_id');plan=read('plan').set_index('customer_id')
 loans=read('loans');cards=read('cards');ev=read('delinquencies');usage=read('card_monthly');h=read('monthly_history');budget=read('loan_monthly_budget');model=read('model_inputs').set_index('customer_id');target=read('target_metadata').set_index('customer_id')
 validate_card_accounts(D)
 checks={}
 def check(name,value):
  checks[name]=bool(value)
  assert checks[name],name
 def aligned(frame,col,agg):return frame.groupby('customer_id')[col].agg(agg).reindex(b.index,fill_value=0)
 check('exact_207_schema',list(b.reset_index().columns)==json.loads((R/'reference/original_priors.json').read_text())['headers'])
 check('ids_unique_and_disjoint',b.index.is_unique and not set(b.index)&set(pd.read_csv(R/'data/base_207.csv')['식별구분']))
 check('plan_profile_age_equal',p.age.equals(plan.age))
 check('adult_history_bound',(p.credit_history_days <= (p.age-19)*365).all())
 check('loan_count_from_ledger',np.array_equal(aligned(loans,'account_id','count'),b.L00000001))
 check('loan_balance_from_ledger',np.array_equal(aligned(loans,'balance_thousand','sum'),b.L00000002))
 check('loan_service_from_ledger',np.array_equal(aligned(loans,'annual_service_thousand','sum'),b.LRZ021201))
 check('loan_history_from_ledger',np.array_equal(aligned(loans,'age_days','max'),b.L23003700))
 check('card_history_from_ledger',np.array_equal(aligned(cards,'age_days','max'),b.C00000090))
 check('card_count_from_ledger',np.array_equal(aligned(cards,'account_id','count'),p.credit_card_count))
 check('total_credit_count',np.array_equal(b.KC1000025,b.L00000001+p.credit_card_count+b.G00000001))
 for sector,col in [(1,'L00060002'),(2,'L00080002'),(3,'L00140002'),(4,'LA0099212')]:
  check(f'sector_{sector}_balance',np.array_equal(aligned(loans[loans.sector==sector],'balance_thousand','sum'),b[col]))
 for table in [loans,cards]:
  check('account_age_bound_'+str(len(table)),(table.age_days<=table.customer_id.map(p.credit_history_days)).all() and (table.age_days>0).all())
 used=usage.assign(used=usage.spend_thousand>0)
 check('card_usage_month_count',np.array_equal(aligned(used,'used','sum'),b.CF1200619))
 check('card_usage_available',((usage.available==1)|(usage.spend_thousand==0)).all())
 check('card_components_sum',np.allclose(usage.spend_thousand,usage.cash_thousand+usage.single_thousand+usage.installment_thousand))
 check('sparse_card_months_at_most_two',(p.loc[p.cohort=='sparse_history','credit_card_observed_months']<=2).all())
 short=p.cohort=='short_history';none=p.cohort=='no_credit';young=p.cohort=='young_established'
 check('short_history_bounds',p.loc[short,'credit_history_days'].between(30,730).all() and (p.loc[short,'current_loan_count']<=1).all() and (p.loc[short,'credit_card_count']<=1).all())
 check('young_established_not_thin',p.loc[young,'age'].between(23,29).all() and (p.loc[young,'credit_history_days']>=1095).all() and (p.loc[young,'credit_card_count']>=2).all())
 check('no_credit_zero_accounts',(p.loc[none,['current_loan_count','credit_card_count','credit_history_days','snapshot_annual_debt_service_krw']]==0).all().all())
 check('no_credit_no_events',not ev.customer_id.isin(p.index[none]).any())
 accounts=pd.concat([loans[['account_id','customer_id','age_days']],cards[['account_id','customer_id','age_days']]]).set_index('account_id')
 check('events_link_real_accounts',ev.account_id.isin(accounts.index).all())
 linked=accounts.loc[ev.account_id]
 check('events_same_customer',np.array_equal(linked.customer_id,ev.customer_id))
 check('events_not_before_account_open',(ev.start_days_ago.to_numpy()<linked.age_days.to_numpy()).all())
 check('duration_not_before_open',(ev.duration_days<=ev.start_days_ago+1).all())
 check('event_endpoint',np.array_equal(ev.end_days_ago,np.maximum(ev.start_days_ago-ev.duration_days,0)))
 check('one_event_per_account',not ev.account_id.duplicated().any())
 late=ev[(ev.duration_days>=30)&(ev.end_days_ago<=365)]
 check('delinquency_count_from_events',np.array_equal(aligned(late,'event_id','count'),b.DQ1200001))
 check('no_payments_before_open',((pd.to_datetime(budget.month)+pd.offsets.MonthEnd(0)>=pd.to_datetime(budget.opened_date))|(budget.budget_service_krw==0)).all())
 hh=h.set_index(['customer_id','month']);bb=budget.groupby(['customer_id','month']).budget_service_krw.sum().reindex(hh.index,fill_value=0)
 check('monthly_budget_matches_ledger',np.array_equal(hh.debt_service_krw,bb))
 check('annual_budget_matches_history',np.array_equal(aligned(h,'debt_service_krw','sum'),p.annual_debt_service_krw))
 check('annual_income_matches_history',np.array_equal(aligned(h,'income_krw','sum'),p.annual_income_krw))
 check('cash_identity',np.array_equal(h.net_cash_krw,h.income_krw-h.expense_total_krw-h.debt_service_krw))
 balance=h.customer_id.map(p.liquid_assets_krw)+h.groupby('customer_id').net_cash_krw.cumsum()
 check('balance_identity',np.array_equal(balance,h.liquid_balance_krw))
 check('missing_cb_not_good_score',np.array_equal(model.CB.isna(),p.cb_available==0))
 check('no_history_arrears_missing',model.loc[none,['SP','DQ1200001','KC5000016']].isna().all().all())
 check('no_statement_utilization_missing',np.array_equal(model.CL0631905.isna(),model.credit_usage_available==0))
 check('no_future_data_in_inputs',not {'target_design_probability','future_credit_exposure','cohort','is_thinfile_scenario','age','PRE_RT','PRE_LMT'}&set(model.columns))
 check('no_future_data_in_profiles',not {'target_design_probability','future_credit_exposure'}&set(p.columns))
 check('label_without_future_exposure_is_zero',(p.loc[target.future_credit_exposure==0,'label_any_delinquency_12m']==0).all())
 check('snapshot_vs_history_dsr',(p.annual_debt_service_krw<=p.snapshot_annual_debt_service_krw).all()) # integer annual allocation before masking pre-opening months
 cfg=json.loads((D/'generation_summary.json').read_text())['config']
 with tempfile.TemporaryDirectory() as td:
  byte_identical={}
  run(td,cfg['per_cohort'],cfg['seed'])
  for name in ['base_207','profiles','monthly_history','scenarios','loans','cards','delinquencies','model_inputs','target_metadata','card_account_monthly']:
   a,b2=pd.read_csv(D/f'{name}.csv'),pd.read_csv(Path(td)/f'{name}.csv')
   same=True
   try:assert_reproduced(name,a,b2)
   except AssertionError:same=False
   check('reproduce_'+name,same)
   byte_identical[name]=(D/f'{name}.csv').read_bytes()==(Path(td)/f'{name}.csv').read_bytes()  # informational only
 # No-loan/no-card generation is robust even with one occupation and constant debt.
 from generate.extend import build
 import yaml
 subset=b.loc[none].reset_index().iloc[:12].copy();subset.HAC_CD='1'
 cfg2=json.loads((R/'extension_config.json').read_text());cfg2['rows']=0
 _,pp,hh,_,_=build(subset,cfg2,yaml.safe_load((R/'reference/claude_config.yaml').read_text()))
 check('constant_zero_debt_single_occupation_no_nan',np.isfinite(pp.select_dtypes('number')).all().all())
 report={'status':'PASS','checks':checks,'count':len(checks),'byte_identical_informational':byte_identical,'note':'IDs, integer amounts, counts and undeclared fields compare exactly; declared continuous fields use rtol=1e-9, atol=0; missingness and dtypes must match; byte equality is informational'}
 print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':
 import argparse
 ap=argparse.ArgumentParser();ap.add_argument('--data',default=str(D));a=ap.parse_args();D=Path(a.data);main()
