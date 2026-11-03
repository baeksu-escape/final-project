from pathlib import Path
import pandas as pd,numpy as np,json
R=Path(__file__).resolve().parents[1];D=R/'assumption_sensitivity'
c=pd.read_csv(D/'customer_cashflow_sensitivity.csv');m=pd.read_csv(D/'cashflow_summary.csv');e=pd.read_csv(D/'exposure_labels.csv');es=pd.read_csv(D/'exposure_summary.csv')
config=json.loads((D/'config.json').read_text())
legacy_ids=set(pd.read_csv(R/'data/profiles.csv').customer_id)
thinfile_ids=set(pd.read_csv(R/'thinfile/profiles.csv').customer_id)
cashflow_ids=legacy_ids|thinfile_ids
cashflow_scenarios={(item[0],item[1]) for item in config['settings']}
expected_cashflow_keys={(cid,factor,level) for cid in cashflow_ids for factor,level in cashflow_scenarios}
assert set(map(tuple,c[['customer_id','factor','level']].itertuples(index=False,name=None)))==expected_cashflow_keys
exposure_config=config['exposure']
if isinstance(exposure_config,list):
 expected_exposure_level_count=len(exposure_config)
else:
 configured_level_counts={len(values) for values in exposure_config.values()}
 assert len(configured_level_counts)==1
 expected_exposure_level_count=configured_level_counts.pop()
exposure_levels=sorted(e.level.unique())
assert len(exposure_levels)==expected_exposure_level_count
expected_exposure_keys={(cid,level) for cid in thinfile_ids for level in exposure_levels}
assert set(map(tuple,e[['customer_id','level']].itertuples(index=False,name=None)))==expected_exposure_keys
assert not c.duplicated(['customer_id','factor','level']).any()
for row in m.itertuples():
 g=c[(c.cohort==row.cohort)&(c.segment==row.segment)&(c.factor==row.factor)&(c.level==row.level)]
 values={'mean_income_cv':g.income_cv.mean(),'mean_zero_months':g.zero_income_months.mean(),'mean_deficit_months':g.deficit_months.mean(),'annual_deficit_rate':(g.annual_shortfall_krw>0).mean(),'ever_negative_liquid_rate':(g.months_liquid_negative>0).mean(),'telecom_late_rate':(g.telecom_late_months>0).mean(),'utility_late_rate':(g.utility_late_months>0).mean()}
 assert len(g)==row.n
 for k,v in values.items():assert abs(v-getattr(row,k))<1e-12
for row in es.itertuples():
 g=e[(e.cohort==row.cohort)&(e.level==row.level)];assert len(g)==row.n and g.exposed.sum()==row.exposed_count and g.label.sum()==row.positive_count
 assert abs(g.label.mean()-row.overall_positive_rate)<1e-12
 assert abs(g[g.exposed==1].label.mean()-row.exposed_positive_rate)<1e-12
w=e.pivot(index='customer_id',columns='level',values=['exposed','label'])
for field in ['exposed','label']:assert ((w[field].low<=w[field].baseline)&(w[field].baseline<=w[field].high)).all()
assert (w['exposed'].low<w['exposed'].baseline).any()
assert (w['exposed'].baseline<w['exposed'].high).any()
assert (e.loc[e.exposed==0,'label']==0).all()
for cid,g in c.groupby('customer_id'):
 assert g.annual_income_krw.nunique()==1 and g.annual_shortfall_krw.nunique()==1 and g.ending_liquid_balance_krw.nunique()==1
print(json.dumps({'status':'PASS','cashflow_rows':len(c),'exposure_rows':len(e),'summary_rows':len(m),'checks':['unique_customer_scenarios','cashflow_summary_recomputed','exposure_summary_recomputed','exposure_and_labels_nested','exposure_levels_are_distinct','unexposed_label_zero','annual_totals_unchanged']},indent=2))
