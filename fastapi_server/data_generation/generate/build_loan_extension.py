"""Replay synthetic original ledger; append explicitly assumed forward amortization."""
from pathlib import Path
import ast,copy,json,hashlib,csv
from decimal import Decimal,ROUND_HALF_UP
import numpy as np,pandas as pd
from generate.synthesis_logic import quantize_rate,amortization_rows
R=Path(__file__).resolve().parents[1]

def money(x):return int(Decimal(str(x)).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
def assign_repayment_methods(account_ids,kinds,config):
 """계좌 ID 해시(0~1)로 종류별 확률표에서 상환방식을 고른다. 위험도·라벨과 무관하다."""
 order=config['method_order'];out=[]
 for account_id,kind in zip(account_ids,kinds):
  probs=config['kinds'][str(int(kind))]
  u=int(hashlib.sha256((config['hash_salt']+account_id).encode()).hexdigest()[:8],16)/16**8
  cumulative=0;chosen=order[-1]
  for name in order:
   cumulative+=probs[name]['value']
   if u<cumulative:chosen=name;break
  out.append(chosen)
 return out
def run():
 out=R/'loan_extension';out.mkdir(exist_ok=True)
 source=(R/'reference/academy/generate_dataset_original.py').read_text()
 tree=ast.parse(source)
 functions=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='generate']
 if len(functions)!=1:raise RuntimeError('Expected exactly one generate() function in the bundled source')
 def assigns_card_count(statement):
  targets=statement.targets if isinstance(statement,ast.Assign) else [statement.target] if isinstance(statement,(ast.AnnAssign,ast.NamedExpr)) else []
  return any(isinstance(node,ast.Name) and node.id=='card_count' for target in targets for node in ast.walk(target))
 boundary_indexes=[i for i,statement in enumerate(functions[0].body) if assigns_card_count(statement)]
 if len(boundary_indexes)!=1:raise RuntimeError('Could not identify the unique card-ledger boundary in the bundled source')
 replay_function=copy.deepcopy(functions[0])
 replay_function.body=replay_function.body[:boundary_indexes[0]]+[ast.Return(value=ast.Call(func=ast.Name(id='locals',ctx=ast.Load()),args=[],keywords=[]))]
 module_nodes=[node for node in tree.body if isinstance(node,(ast.Import,ast.ImportFrom,ast.Assign))]
 module_nodes.append(replay_function)
 replay_module=ast.fix_missing_locations(ast.Module(body=module_nodes,type_ignores=[]))
 ns={'__file__':str(R/'reference/replay.py')};exec(compile(replay_module,str(R/'reference/academy/generate_dataset_original.py'),'exec'),ns)
 v=ns['generate']();base=pd.read_csv(R/'data/base_207.csv');ix=base['식별구분'].str[3:].astype(int).to_numpy()-1
 required_ledger_fields={'result','active','sector','kind','inst','amounts','age','remain','rate','annual'}
 missing_ledger_fields=required_ledger_fields-set(v)
 if missing_ledger_fields:raise RuntimeError(f'Loan replay state is incomplete: {sorted(missing_ledger_fields)}')
 checked=[]
 for col,values in v['result'].items():
  if col in base and (col.startswith(('L','B')) or col in ['식별구분']):
   a=np.asarray(values)[ix];b=base[col].to_numpy()
   if np.issubdtype(a.dtype,np.number):assert np.allclose(a,b,rtol=0,atol=1e-10),col
   else:assert np.array_equal(a.astype(str),b.astype(str)),col
   checked.append(col)
 rows=[]
 for cid,i in zip(base['식별구분'],ix):
  for j in np.flatnonzero(v['active'][i]):
   rows.append(dict(customer_id=cid,account_id=f'{cid}_L{j}',sector=int(v['sector'][i,j]),kind=int(v['kind'][i,j]),institution_id=int(v['inst'][i,j]),balance_thousand=int(v['amounts'][i,j]),age_days=int(v['age'][i,j]),remaining_months=int(v['remain'][i,j]),annual_rate=quantize_rate(v['rate'][i,j]),annual_service_thousand=int(v['annual'][i,j])))
 legacy=pd.DataFrame(rows);legacy.to_csv(out/'legacy_loans.csv',index=False)
 loans=pd.concat([legacy.assign(cohort_source='legacy'),pd.read_csv(R/'thinfile/loans.csv').assign(cohort_source='thinfile')],ignore_index=True)
 loans['balance_krw']=loans.balance_thousand*1000
 loans['snapshot_annual_service_krw']=loans.annual_service_thousand*1000
 repayment_config=json.loads((R/'reference/repayment_method_assumptions.json').read_text(encoding='utf-8'))
 loans['repayment_method']=assign_repayment_methods(loans.account_id,loans.kind,repayment_config)
 loans['repayment_method_basis']=repayment_config['assignment_basis']
 loans['rate_type']=['variable' if int(hashlib.sha256(x.encode()).hexdigest()[:8],16)%2 else 'fixed' for x in loans.account_id]
 loans['rate_type_basis']='deterministic_demo_assumption'
 loans['as_of_date']='2026-09-18';loans['schedule_start']='2026-10'
 loans.to_csv(out/'loans.csv',index=False)
 # 상환방식별 일정(amortization_rows). Rate shock starts at month 1, only variable accounts reset.
 fields=['customer_id','account_id','scenario','month_index','month','opening_balance_krw','annual_rate','principal_krw','interest_krw','payment_krw','closing_balance_krw']
 summary=[]
 with (out/'schedule.csv').open('w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
  for row in loans.itertuples():
   for scenario,shock in [('baseline',0),('rate_plus_2pp',.02)]:
    bal=int(row.balance_krw);n=int(row.remaining_months);paid=0;first12=0
    rate=Decimal(str(row.annual_rate))+(Decimal(str(shock)) if row.rate_type=='variable' else 0)
    for t,(principal,interest) in enumerate(amortization_rows(bal,n,rate,row.repayment_method),start=1):
     close=bal-principal;payment=principal+interest
     assert close>=0 and payment==principal+interest
     start_year,start_month=map(int,row.schedule_start.split('-'))
     absolute_month=start_year*12+(start_month-1)+(t-1)
     year,month0=divmod(absolute_month,12);month=month0+1
     w.writerow(dict(customer_id=row.customer_id,account_id=row.account_id,scenario=scenario,month_index=t,month=f'{year}-{month:02}',opening_balance_krw=bal,annual_rate=str(rate),principal_krw=principal,interest_krw=interest,payment_krw=payment,closing_balance_krw=close))
     paid+=principal
     if t<=12:first12+=payment
     bal=close
    assert bal==0 and paid==row.balance_krw
    summary.append(dict(customer_id=row.customer_id,account_id=row.account_id,scenario=scenario,forward_12m_service_krw=first12,snapshot_annual_service_krw=row.snapshot_annual_service_krw,difference_krw=first12-row.snapshot_annual_service_krw))
 pd.DataFrame(summary).to_csv(out/'service_comparison.csv',index=False)
 # Generation owns summaries; verification only compares saved values.
 schedule=pd.read_csv(out/'schedule.csv')
 ids=pd.concat([pd.read_csv(R/'data/profiles.csv')[['customer_id','annual_income_krw']],pd.read_csv(R/'thinfile/profiles.csv')[['customer_id','annual_income_krw']]],ignore_index=True)
 horizons=[]
 for scenario in ['baseline','rate_plus_2pp']:
  for horizon in [3,6,12]:
   total=schedule[(schedule.scenario==scenario)&(schedule.month_index<=horizon)].groupby('customer_id').payment_krw.sum()
   frame=ids.copy();frame['scenario']=scenario;frame['horizon_months']=horizon
   frame['scheduled_service_krw']=frame.customer_id.map(total).fillna(0).astype('int64');horizons.append(frame)
 pd.concat(horizons,ignore_index=True).to_csv(out/'customer_horizons.csv',index=False)
 (out/'validation.json').write_text(json.dumps({'generation_status':'COMPLETED','validation_status':'NOT_RUN','original_replay_columns':checked,'legacy_accounts':len(legacy),'all_accounts':len(loans),'all_customer_count':len(ids),'note':'This file records generation metadata only. It is not an independent validation result. Original aggregate annual service is an approximation; forward service intentionally differs.'},ensure_ascii=False,indent=2))
 print('GENERATION_COMPLETED',len(legacy),len(loans),len(checked))
if __name__=='__main__':run()
