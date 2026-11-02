"""Controlled synthetic signal recovery; never changes original labels."""
from pathlib import Path
import json
import numpy as np,pandas as pd
from scipy.special import expit
from scipy.optimize import brentq
from sklearn.model_selection import train_test_split
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score,average_precision_score,brier_score_loss,log_loss
R=Path(__file__).resolve().parents[1]
B=['CB','SP','L00000001','L00000002','DQ1200001','KC5000016','LRZ021201','CL0631905']
A=['annual_income_krw','expense_ratio','dsr','income_cv','telecom_late_months','utility_late_months']
CFG={'split_seed':42,'label_seeds':[501,502,503,504,505],'test_fraction':.3,'train_mean_probability':.1,'effect_logit_sd':.5,'missing_fraction':.2,'measurement_noise_sd':.25,'financial_weights':[.35,.25,.15,.15,.45,.2,.25,.15],'alternative_weights':[-.15,.15,.3,.2,.3,.2]}
def main():
 out=R/'nonfinancial_experiment';out.mkdir(exist_ok=True)
 legacy=pd.read_csv(R/'data/base_207.csv').merge(pd.read_csv(R/'data/profiles.csv'),left_on='식별구분',right_on='customer_id',validate='one_to_one');legacy['group']='legacy'
 thin=pd.read_csv(R/'thinfile/model_inputs.csv');raw=pd.read_csv(R/'thinfile/base_207.csv')[['식별구분','LRZ021201']];thin=thin.merge(raw,left_on='customer_id',right_on='식별구분',validate='one_to_one');prof=pd.read_csv(R/'thinfile/profiles.csv')[['customer_id','cohort']];thin=thin.merge(prof,on='customer_id',validate='one_to_one').rename(columns={'cohort':'group'})
 metrics=[];labels=[];predictions=[];splits=[];configuration={}
 for group,d in pd.concat([legacy,thin],ignore_index=True).groupby('group'):
  d=d.reset_index(drop=True);X=d[B+A].astype(float).copy()
  for c in ['L00000002','LRZ021201','annual_income_krw']:X[c]=np.log1p(X[c])
  tr,te=train_test_split(np.arange(len(d)),test_size=.3,random_state=42)
  for i in range(len(d)):splits.append({'customer_id':d.customer_id[i],'group':group,'split':'train' if i in set(tr) else 'test'})
  prep=make_pipeline(SimpleImputer(strategy='median',keep_empty_features=True),StandardScaler());prep.fit(X.iloc[tr]);Z=prep.transform(X)
  core=Z[:,:len(B)]@np.array(CFG['financial_weights']);effect=Z[:,len(B):]@np.array(CFG['alternative_weights']);sd=effect[tr].std();effect=(effect-effect[tr].mean())/(sd if sd else 1)
  probs={}
  for strength in [0,.5]:
   risk=core+strength*effect;a=brentq(lambda a:expit(a+risk[tr]).mean()-.1,-50,50);probs[strength]=expit(a+risk)
  configuration[group]={'train_rows':len(tr),'test_rows':len(te),'effect_train_sd':float(sd)}
  for seed in CFG['label_seeds']:
   rng=np.random.default_rng(seed);u=rng.random(len(d));yn=(u<probs[0]).astype(int);yw=(u<probs[.5]).astype(int)
   noisy=X.copy();scale=X.iloc[tr][A].std().fillna(0);noise=rng.normal(0,.25,(len(d),len(A)))*scale.to_numpy();observed=noisy[A].to_numpy()+noise;observed[rng.random(observed.shape)<.2]=np.nan;noisy[A]=observed
   for scenario,y,xx,prob in [('no_effect',yn,X,probs[0]),('weak',yw,X,probs[.5]),('weak_degraded',yw,noisy,probs[.5])]:
    for i in range(len(d)):labels.append({'customer_id':d.customer_id[i],'group':group,'seed':seed,'scenario':scenario,'experiment_label':int(y[i]),'design_probability':float(prob[i])})
    for name,cols in [('financial',B),('alternative',B+A)]:
     model=make_pipeline(SimpleImputer(strategy='median',add_indicator=True,keep_empty_features=True),StandardScaler(),LogisticRegression(max_iter=3000))
     model.fit(xx.iloc[tr][cols],y[tr]);p=model.predict_proba(xx.iloc[te][cols])[:,1];assert np.isfinite(p).all()
     metrics.append(dict(group=group,seed=seed,scenario=scenario,model=name,n_test=len(te),positive_rate=float(y[te].mean()),roc_auc=roc_auc_score(y[te],p),average_precision=average_precision_score(y[te],p),brier=brier_score_loss(y[te],p),log_loss=log_loss(y[te],p,labels=[0,1]),prediction_coverage=1.0))
     for i,pr in zip(te,p):predictions.append(dict(customer_id=d.customer_id[i],group=group,seed=seed,scenario=scenario,model=name,label=int(y[i]),probability=float(pr)))
 m=pd.DataFrame(metrics);m.to_csv(out/'metrics.csv',index=False);pd.DataFrame(labels).to_csv(out/'experiment_labels.csv',index=False);pd.DataFrame(predictions).to_csv(out/'heldout_predictions.csv',index=False);pd.DataFrame(splits).to_csv(out/'split.csv',index=False)
 wide=m.pivot(index=['group','seed','scenario'],columns='model',values=['roc_auc','average_precision','brier']);gain=pd.DataFrame({'auc_gain':wide.roc_auc.alternative-wide.roc_auc.financial,'ap_gain':wide.average_precision.alternative-wide.average_precision.financial,'brier_reduction':wide.brier.financial-wide.brier.alternative}).reset_index();gain.to_csv(out/'paired_differences.csv',index=False)
 summary=gain.groupby(['group','scenario'])[['auc_gain','ap_gain','brier_reduction']].agg(['mean','std']);summary.to_csv(out/'summary.csv');(out/'config.json').write_text(json.dumps({**CFG,'financial_features':B,'alternative_features':A,'groups':configuration,'interpretation':'Conditional synthetic label experiment, assumes exposure for everyone; does not reuse original future exposure or original labels. No real-world predictive validation.'},indent=2))
 print(summary.round(4).to_string())
if __name__=='__main__':main()
