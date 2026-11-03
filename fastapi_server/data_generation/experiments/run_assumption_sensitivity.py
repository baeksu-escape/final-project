from pathlib import Path
import copy,json,hashlib
import numpy as np,pandas as pd,yaml
from generate.extend import build
from generate.build_thinfile import make_service
from generate.thinfile_engine import generate as generate_thinfile
R=Path(__file__).resolve().parents[1]

def main():
 out=R/'assumption_sensitivity';out.mkdir(exist_ok=True)
 cfg0=json.loads((R/'extension_config.json').read_text());prior0=yaml.safe_load((R/'reference/claude_config.yaml').read_text())
 settings=[('baseline','baseline',1),('freelance_zero','low',.5),('freelance_zero','high',1.5),('income_sigma','low',.5),('income_sigma','high',1.5),('arrears_incidence','low',.5),('arrears_incidence','high',1.5)]
 metrics=[];profiles=[];checks=[]
 for population in ['legacy','thinfile']:
  folder=R/('data' if population=='legacy' else 'thinfile');base=pd.read_csv(folder/'base_207.csv');original=pd.read_csv(folder/'profiles.csv');cfg=copy.deepcopy(cfg0);cfg['rows']=0
  if population=='thinfile':
   info=json.loads((folder/'generation_summary.json').read_text());cfg['seed']=info['config']['seed'];plan=pd.read_csv(folder/'plan.csv');cfg['age_by_customer']=dict(zip(plan.customer_id,plan.age));cfg['service_by_customer'],_=make_service(plan,pd.read_csv(folder/'loans.csv'),cfg)
  baseline=None
  for factor,level,mult in settings:
   c=copy.deepcopy(cfg);prior=copy.deepcopy(prior0)
   if factor=='freelance_zero':c['zero_income_month_probability']['freelance']*=mult
   if factor=='income_sigma':c['monthly_sigma']={k:v*mult for k,v in c['monthly_sigma'].items()}
   if factor=='arrears_incidence':
    prior['alt']['utility_arrears_by_decile']=[min(1,x*mult) for x in prior['alt']['utility_arrears_by_decile']]
    for k in ['telecom_base','telecom_given_utility']:prior['alt'][k]*=mult
    assert prior['alt']['telecom_base']+prior['alt']['telecom_given_utility']<=1
   _,p,h,_,validation=build(base,c,prior)
   if baseline is None:
    baseline=p.copy()
    pd.testing.assert_frame_equal(p,original[p.columns],check_exact=False,rtol=1e-12,atol=0)
   for col in ['annual_income_krw','annual_debt_service_krw','debt_balance_krw','label_any_delinquency_12m','asset_total_krw','liquid_assets_krw']:
    assert np.array_equal(p[col],baseline[col]),col
   assert np.array_equal(h.net_cash_krw,h.income_krw-h.expense_total_krw-h.debt_service_krw)
   if population=='thinfile':p=p.merge(original[['customer_id','cohort']],on='customer_id',validate='one_to_one')
   else:p['cohort']='legacy'
   p['factor']=factor;p['level']=level;p['population']=population
   keep=['customer_id','population','cohort','segment','factor','level','annual_income_krw','income_cv','zero_income_months','deficit_months','months_liquid_negative','min_liquid_balance_krw','ending_liquid_balance_krw','annual_shortfall_krw','telecom_late_months','utility_late_months']
   profiles.append(p[keep])
   for (cohort,segment),g in p.groupby(['cohort','segment']):
    metrics.append(dict(population=population,cohort=cohort,segment=segment,factor=factor,level=level,n=len(g),mean_income_cv=g.income_cv.mean(),mean_zero_months=g.zero_income_months.mean(),mean_deficit_months=g.deficit_months.mean(),annual_deficit_rate=(g.annual_shortfall_krw>0).mean(),ever_negative_liquid_rate=(g.months_liquid_negative>0).mean(),telecom_late_rate=(g.telecom_late_months>0).mean(),utility_late_rate=(g.utility_late_months>0).mean()))
   checks.append(dict(population=population,factor=factor,level=level,status='PASS'))
 pd.concat(profiles,ignore_index=True).to_csv(out/'customer_cashflow_sensitivity.csv',index=False);pd.DataFrame(metrics).to_csv(out/'cashflow_summary.csv',index=False)
 # Re-execute unchanged thin-file engine with only two exposure thresholds varied.
 src=(R/'generate/thinfile_engine.py').read_text();plan=pd.read_csv(R/'thinfile/plan.csv');seed=json.loads((R/'thinfile/generation_summary.json').read_text())['config']['seed'];old=pd.read_csv(R/'thinfile/base_207.csv');oldmeta=pd.read_csv(R/'thinfile/target_metadata.csv');exposure_rows=[];summ=[];reference=None
 exposure_scenarios=[{'level':'low','no_credit_probability':.175,'sparse_history_probability':.10},{'level':'baseline','no_credit_probability':.35,'sparse_history_probability':.20},{'level':'high','no_credit_probability':.525,'sparse_history_probability':.30}]
 for scenario in exposure_scenarios:
  level=scenario['level'];a=scenario['no_credit_probability'];b=scenario['sparse_history_probability']
  base,_,_,ledgers=generate_thinfile(plan,seed,no_credit_exposure_probability=a,sparse_history_exposure_probability=b);av=ledgers['availability'];label=(base['결과값(연체회차)']>0).astype(int)
  for col in old.columns:
   if pd.api.types.is_numeric_dtype(old[col]):base[col]=pd.to_numeric(base[col])
  pd.testing.assert_frame_equal(base.drop(columns='결과값(연체회차)'),old.drop(columns='결과값(연체회차)'),check_dtype=False,check_exact=False,rtol=1e-12,atol=0)
  if level=='baseline':
   assert np.array_equal(base['결과값(연체회차)'],old['결과값(연체회차)']);assert np.array_equal(av.future_credit_exposure,oldmeta.future_credit_exposure)
  assert (label[av.future_credit_exposure==0]==0).all()
  data=pd.DataFrame(dict(customer_id=av.customer_id,cohort=av.cohort,level=level,exposed=av.future_credit_exposure,label=label,design_probability=av.target_design_probability));exposure_rows.append(data)
  for cohort,g in data.groupby('cohort'):
   used=g[g.exposed==1];summ.append(dict(level=level,cohort=cohort,n=len(g),exposed_count=len(used),positive_count=int(g.label.sum()),overall_positive_rate=g.label.mean(),exposed_positive_rate=used.label.mean(),mean_design_probability=g.design_probability.mean()))
 pd.concat(exposure_rows).to_csv(out/'exposure_labels.csv',index=False);pd.DataFrame(summ).to_csv(out/'exposure_summary.csv',index=False)
 (out/'validation.json').write_text(json.dumps({'status':'PASS','cashflow_runs':checks,'exposure_runs':3,'baseline_matches_saved_data':True,'cashflow_original_labels_unchanged':True,'exposure_non_target_features_unchanged':True},indent=2))
 (out/'config.json').write_text(json.dumps({'settings':settings,'base_extension_config':cfg0,'base_arrears':{k:prior0['alt'][k] for k in ['utility_arrears_by_decile','telecom_base','telecom_given_utility']},'exposure':exposure_scenarios,'seed_policy':'fixed original seed per population; same random draws within each one-factor comparison','engine_sha256':hashlib.sha256(src.encode()).hexdigest()},indent=2))
 print(pd.DataFrame(summ).to_string(index=False));print('PASS 14 cashflow runs + 3 exposure runs')
if __name__=='__main__':main()
