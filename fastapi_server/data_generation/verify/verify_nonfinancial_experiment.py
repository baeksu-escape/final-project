from pathlib import Path
import pandas as pd,numpy as np,json
from sklearn.metrics import roc_auc_score,average_precision_score,brier_score_loss,log_loss
R=Path(__file__).resolve().parents[1];D=R/'nonfinancial_experiment'
s=pd.read_csv(D/'split.csv',keep_default_na=False);l=pd.read_csv(D/'experiment_labels.csv',keep_default_na=False);p=pd.read_csv(D/'heldout_predictions.csv',keep_default_na=False);m=pd.read_csv(D/'metrics.csv',keep_default_na=False)
assert s.customer_id.is_unique
assert set(s[s.split=='train'].customer_id).isdisjoint(s[s.split=='test'].customer_id)
source_ids=set(pd.read_csv(R/'data/profiles.csv').customer_id)|set(pd.read_csv(R/'thinfile/profiles.csv').customer_id)
assert set(s.customer_id)==source_ids
assert not p.duplicated(['customer_id','seed','scenario','model']).any()
assert set(p.customer_id)==set(s[s.split=='test'].customer_id)
a=l[l.scenario=='weak'].drop(columns='scenario').reset_index(drop=True);b=l[l.scenario=='weak_degraded'].drop(columns='scenario').reset_index(drop=True);pd.testing.assert_frame_equal(a,b)
for (g,seed,scenario),x in p.groupby(['group','seed','scenario']):
 a=x[x.model=='financial'].set_index('customer_id');b=x[x.model=='alternative'].set_index('customer_id');assert a.index.equals(b.index);assert np.array_equal(a.label,b.label)
for row in m.itertuples():
 x=p[(p.group==row.group)&(p.seed==row.seed)&(p.scenario==row.scenario)&(p.model==row.model)]
 for name,fn in [('roc_auc',roc_auc_score),('average_precision',average_precision_score),('brier',brier_score_loss),('log_loss',lambda y,q:log_loss(y,q,labels=[0,1]))]:
  # Same log_loss call as run_nonfinancial_experiment.py. A test set with one class leaves ranking metrics undefined (saved blank); both sides must then be NaN.
  stored=pd.to_numeric(getattr(row,name),errors='coerce')
  try:value=float(fn(x.label,x.probability))
  except ValueError:value=float('nan')
  assert (np.isnan(stored) and np.isnan(value)) or abs(value-stored)<1e-12,(row.group,row.seed,row.scenario,row.model,name)
# Financial inputs/labels unaffected between weak and degraded, so predictions must match.
a=p[(p.scenario=='weak')&(p.model=='financial')].drop(columns='scenario').reset_index(drop=True);b=p[(p.scenario=='weak_degraded')&(p.model=='financial')].drop(columns='scenario').reset_index(drop=True);pd.testing.assert_frame_equal(a,b)
metric_keys=['group','seed','scenario','model']
assert set(map(tuple,m[metric_keys].itertuples(index=False,name=None)))==set(map(tuple,p[metric_keys].drop_duplicates().itertuples(index=False,name=None)))
r={'status':'PASS','customers':len(s),'metric_rows':len(m),'heldout_prediction_rows':len(p),'checks':['split_disjoint','unique_predictions','same_heldout_customers_and_labels','weak_and_degraded_labels_identical','metrics_recomputed','metric_prediction_key_coverage','financial_predictions_unchanged_by_degradation']};print(json.dumps(r,indent=2))
