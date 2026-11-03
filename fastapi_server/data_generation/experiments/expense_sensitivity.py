"""Report how the assumed liquid-asset drawdown fraction changes deficit indicators (not tuned)."""
from pathlib import Path
import json, numpy as np, pandas as pd, yaml
from generate.extend import build
ROOT=Path(__file__).resolve().parents[1]
def main():
    b=pd.read_csv(ROOT/'data/base_207.csv',dtype={'HAC_CD':str,'식별구분':str})
    prior=yaml.safe_load((ROOT/'reference/claude_config.yaml').read_text())
    rows=[]
    for f in [0.0,0.1,0.25,0.5,1.0,None]:
        c=json.loads((ROOT/'extension_config.json').read_text())
        c['expense_drawdown_fraction']=1e9 if f is None else f   # None = no constraint (v2 behaviour)
        _,p,h,_,chk=build(b,c,prior)
        net=h.groupby('customer_id').net_cash_krw.sum().loc[p.customer_id].to_numpy()
        rows.append(dict(drawdown_fraction='none(v2)' if f is None else f,capped_share=chk['expense_capped_share'],annual_net_negative=(net<0).mean(),
            all_12_months_deficit=(p.deficit_months==12).mean(),mean_deficit_months=p.deficit_months.mean(),median_expense_ratio=p.expense_ratio.median(),
            dsr_gt_1=(p.dsr>1).mean()))
    r=pd.DataFrame(rows);r.to_csv(ROOT/'data/expense_sensitivity.csv',index=False);print(r.round(4).to_string(index=False))
if __name__=='__main__':main()
