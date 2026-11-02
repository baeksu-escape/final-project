"""Generate separate thin-file scenario data; never edit data/ (v2.4 cohort)."""
from pathlib import Path
import argparse,json,hashlib
import numpy as np,pandas as pd,yaml
from generate.thinfile_engine import generate
from generate.extend import build
ROOT=Path(__file__).resolve().parents[1]
COHORTS=['no_credit','short_history','sparse_history','young_established']
NO_CREDIT_EXPOSURE_PROBABILITY=.35
SPARSE_HISTORY_EXPOSURE_PROBABILITY=.20
CODES={'1':'wage','2':'selfemp','7':'freelance'}

def make_plan(per_cohort=600,seed=20261030):
 if per_cohort<3:raise ValueError('at least three rows per cohort')
 rng=np.random.default_rng(seed);rows=[]
 for ci,c in enumerate(COHORTS):
  for j in range(per_cohort):
   job=list(CODES)[j%3]
   if c=='sparse_history':age=int(rng.integers(30,60))
   elif c=='young_established':age=int(rng.integers(23,30))
   else:age=int(rng.integers(20,30) if rng.random()<.7 else rng.integers(30,60))
   maxdays=(age-19)*365
   if c=='no_credit':hist=loans=cards=0
   elif c=='short_history':
    hist=int(rng.integers(30,min(730,maxdays)+1));loans=int(rng.random()<.5);cards=int(rng.random()<.8)
    if loans+cards==0:cards=1
   elif c=='sparse_history':hist=int(rng.integers(1095,min(2920,maxdays)+1));loans=0;cards=1
   else:hist=int(rng.integers(1095,min(3650,maxdays)+1));loans=int(rng.integers(1,3));cards=int(rng.integers(2,4))
   debt=0 if loans==0 else int(rng.integers(500,15001) if c=='short_history' else rng.integers(3000,50001))
   rows.append(dict(customer_id=f'THF{ci+1}{j+1:08d}',cohort=c,HAC_CD=job,age=age,history_cap_days=hist,loan_count=loans,card_count=cards,debt_total_thousand=debt,sparse_usage_months=int(rng.integers(0,3)) if c=='sparse_history' else 0))
 return pd.DataFrame(rows)

def make_service(plan,loans,cfg):
 snapshot=pd.Timestamp('2026-09-18')
 ends=pd.period_range(cfg['history_start'],periods=12,freq='M').to_timestamp(how='end').normalize()
 service={cid:np.zeros(12,dtype=np.int64) for cid in plan.customer_id}
 loan_months=[]
 for l in loans.itertuples(index=False):
  opened=snapshot-pd.Timedelta(days=l.age_days)
  monthly,remainder=divmod(int(l.annual_service_thousand*1000),12)
  for i,end in enumerate(ends):
   amount=(monthly+int(i<remainder)) if opened<=end else 0
   service[l.customer_id][i]+=amount
   loan_months.append(dict(customer_id=l.customer_id,account_id=l.account_id,month=str(end.to_period('M')),opened_date=str(opened.date()),budget_service_krw=amount))
 return {cid:v.tolist() for cid,v in service.items()},pd.DataFrame(loan_months)

def run(out,per_cohort=600,seed=20261030):
 out=Path(out);out.mkdir(parents=True,exist_ok=True)
 plan=make_plan(per_cohort,seed)
 base,dictionary,summary,ledgers=generate(plan,seed,no_credit_exposure_probability=NO_CREDIT_EXPOSURE_PROBABILITY,sparse_history_exposure_probability=SPARSE_HISTORY_EXPOSURE_PROBABILITY)
 cfg=json.loads((ROOT/'extension_config.json').read_text());cfg.update(seed=seed,rows=0,age_by_customer=dict(zip(plan.customer_id,plan.age)))
 cfg['service_by_customer'],loan_months=make_service(plan,ledgers['loans'],cfg)
 prior=yaml.safe_load((ROOT/'reference/claude_config.yaml').read_text())
 b,p,h,s,checks=build(base,cfg,prior)
 # Ordered one-to-one metadata join; base has no extra columns.
 target_meta=ledgers['availability'][['customer_id','future_credit_exposure','target_design_probability']].copy()
 ledgers['availability']=ledgers['availability'].drop(columns=['future_credit_exposure','target_design_probability'])
 meta=ledgers['availability'];p=p.merge(meta.drop(columns='age'),on='customer_id',validate='one_to_one')
 p['is_thinfile_scenario']=(p.cohort!='young_established').astype(int)
 p['label_origin']='thinfile_scenario_v25'
 p['snapshot_annual_debt_service_krw']=b.LRZ021201.to_numpy()*1000
 p['snapshot_dsr']=p.snapshot_annual_debt_service_krw/p.annual_income_krw
 p['credit_information_status']=np.where(p.cb_available==1,'educational_score_available','insufficient_history')
 # Metadata and label probability do not enter the model matrix.
 model=b[['식별구분','CB','SP','L00000001','L00000002','DQ1200001','KC5000016','CL0631905']].rename(columns={'식별구분':'customer_id'}).copy()
 for col in ['CB','SP','DQ1200001','KC5000016','CL0631905']:model[col]=model[col].astype(float)
 model.loc[p.cb_available.to_numpy()==0,'CB']=np.nan
 nohist=p.credit_history_days.to_numpy()==0
 for col in ['SP','DQ1200001','KC5000016']:model.loc[nohist,col]=np.nan
 recent=ledgers['card_monthly'].query('month_offset<6').groupby('customer_id').spend_thousand.sum().reindex(p.customer_id).to_numpy()>0
 model.loc[~recent,'CL0631905']=np.nan
 for col in ['credit_history_days','credit_card_observed_months','cb_available','annual_income_krw','expense_ratio','dsr','income_cv','telecom_late_months','utility_late_months']:model[col]=p[col].to_numpy()
 model['credit_usage_available']=recent.astype(int)
 model['label_any_delinquency_12m']=p.label_any_delinquency_12m.to_numpy()
 # UI intentionally masks compatibility placeholders; not an actual credit bureau score.
 ui=p[['customer_id','cohort','segment','age','credit_information_status','cb_available','credit_history_days','current_loan_count','credit_card_count','credit_card_observed_months','annual_income_krw','snapshot_dsr']].copy()
 ui['educational_grade']=model.CB
 for name,frame in {'plan':plan,'base_207':b,'profiles':p,'monthly_history':h,'scenarios':s,'model_inputs':model,'ui_credit_summary':ui,'loan_monthly_budget':loan_months,'target_metadata':target_meta,**ledgers}.items():
  frame.to_csv(out/f'{name}.csv',index=False,encoding='utf-8-sig')
 pd.DataFrame(dictionary).to_csv(out/'column_dictionary_207.csv',index=False,encoding='utf-8-sig')
 p.groupby('cohort').agg(n=('customer_id','size'),twenties=('age',lambda x:int(x.between(20,29).sum())),median_history_days=('credit_history_days','median'),mean_loans=('current_loan_count','mean'),mean_cards=('credit_card_count','mean'),mean_card_months=('credit_card_observed_months','mean'),unavailable_scores=('cb_available',lambda x:int((x==0).sum())),label_rate=('label_any_delinquency_12m','mean')).to_csv(out/'cohort_summary.csv',encoding='utf-8-sig')
 (out/'generation_summary.json').write_text(json.dumps({'engine':summary,'extension':checks,'effective_extension_config':cfg,'config':{'seed':seed,'per_cohort':per_cohort,'counts_are_demo_design':True,'future_exposure_probability_no_credit':NO_CREDIT_EXPOSURE_PROBABILITY,'future_exposure_probability_sparse':SPARSE_HISTORY_EXPOSURE_PROBABILITY,'original_data_untouched':True}},ensure_ascii=False,indent=2))
 print(p.groupby('cohort').size().to_string())
 return out

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--out',default=str(ROOT/'thinfile'));ap.add_argument('--per-cohort',type=int,default=600);ap.add_argument('--seed',type=int,default=20261030);a=ap.parse_args();run(a.out,a.per_cohort,a.seed)
