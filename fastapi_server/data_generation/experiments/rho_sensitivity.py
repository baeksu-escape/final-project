"""Report (not tune) how the assumed income-debt correlation changes plausibility indicators."""
from pathlib import Path
import json, numpy as np, pandas as pd, yaml
from generate.extend import build
ROOT=Path(__file__).resolve().parents[1]
def main():
    b=pd.read_csv(ROOT/'data/base_207.csv',dtype={'HAC_CD':str,'식별구분':str})
    prior=yaml.safe_load((ROOT/'reference/claude_config.yaml').read_text())
    rows=[]
    for rho in [0.0,0.3,0.5,0.7]:
        c=json.loads((ROOT/'extension_config.json').read_text());c['income_debt_copula_rho']=rho
        _,p,_,_,_=build(b,c,prior)
        rows.append(dict(rho=rho,dsr_gt_1=(p.dsr>1).mean(),dsr_gt_0_4=(p.dsr>0.4).mean(),annual_net_negative=(p.worst_month_net_cash_krw*0+ (p.annual_income_krw*(1-p.expense_ratio)-p.annual_debt_service_krw)<0).mean(),
            all_12_months_deficit=(p.deficit_months==12).mean(),median_dsr=p.dsr.median(),wage_monthly_mean=p[p.segment=='wage'].annual_income_krw.mean()/12,wage_monthly_median=p[p.segment=='wage'].annual_income_krw.median()/12))
    r=pd.DataFrame(rows);r.to_csv(ROOT/'data/rho_sensitivity.csv',index=False);print(r.round(4).to_string(index=False))
if __name__=='__main__':main()
