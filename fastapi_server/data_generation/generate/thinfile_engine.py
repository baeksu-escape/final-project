"""v2.5 thin-file ledger engine, adapted from bundled academy generator.
The cohort plan overrides account presence and duration BEFORE aggregation.
See THINFILE.md for design assumptions and unavailable-value semantics.
"""
from pathlib import Path
import argparse,json,hashlib
import numpy as np
import pandas as pd
from scipy.special import ndtr,expit
from generate.synthesis_logic import allocate_card_components, card_subsets, quantize_rate

BASE=Path(__file__).resolve().parents[1]/'reference'

def generate(plan,seed=20261030,target_rate=.10,no_credit_exposure_probability=.35,sparse_history_exposure_probability=.20):
 n=len(plan)
 assert plan.customer_id.is_unique
 assert 0<=no_credit_exposure_probability<=1
 assert 0<=sparse_history_exposure_probability<=1
 cohort=plan.cohort.to_numpy()
 nofile=cohort=="no_credit"
 sparse=cohort=="sparse_history"
 short=cohort=="short_history"
 established=cohort=="young_established"
 horizon=plan.history_cap_days.to_numpy(dtype=int)
 age_years=plan.age.to_numpy(dtype=int)
 # Namespace 212 is reserved for this engine; extend.py uses 213 with the same seed.
 ledger_rng=np.random.default_rng(np.random.SeedSequence([seed,212,0]))
 card_rng=np.random.default_rng(np.random.SeedSequence([seed,212,1]))
 rng=np.random.default_rng(np.random.SeedSequence([seed,212,2]))
 compat_rng=np.random.default_rng(np.random.SeedSequence([seed,212,3]))
 prior=json.loads((BASE/'original_priors.json').read_text(encoding='utf8'))
 refs=json.loads((BASE/'reference_stats.json').read_text(encoding='utf8'))
 cr=refs['credit_card']; gr=refs['south_german']; result={}; meta={}; checks={}
 grid=np.linspace(0,1,101)
 def drawq(q,u=None): return np.interp(rng.random(n) if u is None else u,grid,q)
 def choice(h):
  p=prior['categorical'][h]; return rng.choice(p['values'],n,p=p['probabilities'])
 def add(h,v,unit,rule,source='교육용 설계'):
  assert h not in result,h
  v=np.asarray(v)
  if v.ndim==0: v=np.repeat(v,n)
  assert v.shape==(n,),(h,v.shape)
  result[h]=v
  meta[h]={'column':h,'original_description':prior['original_descriptions'].get(h,'설명 미제공'),'teaching_definition':prior['original_descriptions'].get(h,h),'unit':unit,'generation_rule':rule,'basis':source,'status':'합성 생성','as_of':'2026-09-18'}
 def cnt(mask): return mask.sum(1).astype(np.int64)
 def sumv(v,mask): return np.where(mask,v,0).sum(1).astype(np.int64)
 def minv(v,mask): return np.where(mask,v,10**9).min(1)*(mask.any(1))
 def maxv(v,mask): return np.where(mask,v,0).max(1)
 def pct(num,den): return np.round(np.divide(num*100.,den,out=np.zeros(n),where=den>0),2)
 def unique_count(values,mask):
  x=np.sort(np.where(mask,values,-1),axis=1)
  return ((x>=0)&np.column_stack([np.ones(n,dtype=bool),x[:,1:]!=x[:,:-1]])).sum(1).astype(np.int64)

 # Gaussian rank copula retains observed broad relationships without copying records.
 raw_corr=np.asarray(cr['rank_correlation'],dtype=float)
 raw_corr=(raw_corr+raw_corr.T)/2
 vals,vec=np.linalg.eigh(raw_corr)
 regularized=(vec*np.maximum(vals,.03))@vec.T
 scale=np.sqrt(np.diag(regularized))
 corr=regularized/np.outer(scale,scale)
 corr=(corr+corr.T)/2
 np.fill_diagonal(corr,1.0)
 z=rng.multivariate_normal(np.zeros(4),corr,size=n,check_valid='raise'); u=ndtr(z)
 ref_limit=drawq(cr['limit_NTD_quantiles'],u[:,0])
 util=np.clip(drawq(cr['utilization_ratio_quantiles'],u[:,1])+rng.normal(0,.035,n),0,1.8)
 late_share=np.clip(drawq(cr['late_month_share_quantiles'],u[:,2])+rng.normal(0,.035,n),0,1)
 delay=np.clip(np.rint(drawq(cr['max_delay_month_quantiles'],u[:,3])),0,8)
 rx=np.column_stack([np.log(ref_limit),util,late_share,delay]); rm=cr['risk_model']
 risk=(rx-np.asarray(rm['mean']))/np.asarray(rm['scale'])@np.asarray(rm['coef'])+rm['intercept']
 risk=np.clip(risk,-5,4); riskp=expit(risk)
 add('식별구분',plan.customer_id.to_numpy(),'가상ID','SYN 접두어와 독립 일련번호, 원본 ID와 연결하지 않음')
 limit_krw=np.clip(np.round(drawq(prior['quantiles']['PRE_LMT'])*rng.lognormal(0,.12,n)/100000)*100000,1000000,25000000).astype(np.int64)
 add('PRE_LMT',limit_krw,'원','원본 한도 분포에 승수 잡음, 100만원~2500만원','원본 8,158개 입력 조합의 한도 분포')
 add('PRE_RT',np.round(np.clip(6.0+10*riskp+rng.normal(0,1.8,n),3.5,19.5),2),'연 %','가상 위험도와 독립 잡음, 교육용 범위 3.5~19.5%')
 add('GOODS_CD',choice('GOODS_CD'),'코드','원본 정상 상품코드의 경험적 빈도','원본 코드표와 정상 코드 빈도')
 add('INA_CD',np.array([f'{x:02d}' for x in rng.integers(1,29,n)]),'월 납입일 코드','01~28일, 모든 달에 존재하는 약정 납입일')
 add('AD_NO',choice('AD_NO'),'코드','원본 접수채널 코드 분포','원본 코드표와 정상 코드 빈도')
 living=choice('LIV_ADD'); residence=living.copy(); different=rng.random(n)<.08; residence[different]=choice('LIV_ADD')[different]
 registered=rng.random(n)>.025; residence=np.where(registered,residence,'미등록')
 add('LIV_ADD',living,'시도','17개 광역 지역명, 충청/전라 같은 미확정 묶음 제외','원본 지역 분포')
 add('RES_ADD',residence,'시도','등록 주소, 미등록은 문자열 미등록, 다른 주소는 독립 지역 표집')
 add('ADD_YN',np.where(registered,'Y','N'),'Y/N','RES_ADD가 미등록이면 N, 그 외 Y')
 gm=drawq(gr['duration_month_quantiles'])
 sale=np.clip(np.round((.7*choice('SALE_TRM').astype(float)+.3*gm)/12)*12,12,72).astype(int)
 add('SALE_TRM',sale,'개월','원본 기간과 공개 독일 기간 분포를 70:30으로 혼합한 교육용 만기','원본 기간, UCI South German Credit 기간 분위수')
 job=plan.HAC_CD.astype(str).to_numpy()
 rank=np.char.zfill(choice('RRC_CD'),2); rank=np.where(job=='1',rank,'20')
 add('RRC_CD',rank,'코드','급여소득자는 원본 정상 직급 분포, 그 외 20 기타','원본 코드표, 교육용 조건부 배정')
 add('HAC_CD',job,'코드','직업 비중은 수업 다양성을 위한 명시적 설계, 한국 직업비율 추정 아님','원본 코드표, 교육용 설계 비중')

 # Shared loan ledger: counts, amount buckets, institution counts and history windows
 # are all aggregated from the same virtual accounts.
 K=12; shape=(n,K)
 loan_num=plan.loan_count.to_numpy(dtype=int)
 active=np.arange(K)[None,:]<loan_num[:,None]
 sector=rng.choice(7,shape,p=[.30,.18,.23,.14,.06,.06,.03]) # bank/card/savings/capital/private/mutual/insurance
 kind=rng.choice(9,shape,p=[.65,.11,.04,.035,.015,.055,.025,.04,.03])
 kind=np.where(sector==1,np.where(rng.random(shape)<.88,0,5),kind)
 kind=np.where(sector==4,np.where(rng.random(shape)<.9,0,5),kind)
 base=plan.debt_total_thousand.to_numpy(dtype=float)
 shares=rng.lognormal(0,.9,shape)*active
 amounts=np.round(shares/(shares.sum(1)[:,None]+1e-12)*base[:,None]*rng.lognormal(0,.12,shape)).astype(np.int64)
 amounts=np.where(active,np.maximum(100,amounts),0)
 age=1+(ledger_rng.random(shape)*np.maximum(horizon[:,None]-1,1)).astype(int)
 age=np.minimum(age,horizon[:,None])
 age[:,0]=horizon  # at least one account reaches the designed horizon
 inst=sector*100+rng.integers(1,16,shape)
 bank=active&(sector==0); cardloan=active&(sector==1); savings=active&(sector==2); capital=active&(sector==3); private=active&(sector==4); mutual=active&(sector==5)
 unsecured=active&np.isin(kind,[0,6]); house=active&(kind==1); newcar=active&(kind==2); deposit=active&(kind==3); securities=active&(kind==4); guarantee=active&(kind==5); propertycoll=active&np.isin(kind,[1,7])
 nonbank=active&~bank; noncar=active&~newcar; nonhouse=active&~house
 standard=active&~(deposit|securities|house|newcar)
 def C(h,mask,rule): add(h,cnt(mask),'건',rule,'가상 대출계좌 원장 집계')
 def A(h,mask,rule): add(h,sumv(amounts,mask),'천원',rule,'가상 대출계좌 원장 집계')
 def I(h,mask,rule): add(h,unique_count(inst,mask),'기관',rule,'가상 대출계좌 원장 집계')
 def AGE(h,mask,last,rule): add(h,minv(age,mask) if last else maxv(age,mask),'일',rule+'; 해당 계좌 없으면 0','가상 대출계좌 원장 집계')
 C('L00000001',active,'전체 현재 미상환 계좌 수'); A('L00000002',active,'전체 현재 미상환 잔액 합')
 C('L00000004',noncar,'신차할부 제외 미상환 계좌 수')
 for h,m in [('L00060002',cardloan),('L00080002',savings),('L00140002',capital)]: A(h,m,'해당 업권 미상환 잔액 합')
 C('L00990004',nonbank&noncar,'은행, 신차할부 제외 계좌 수'); C('L00990005',nonbank&noncar&nonhouse,'은행, 신차할부, 주택담보 제외 계좌 수')
 C('L21170900',capital&(age<=90),'90일 이내 개설 캐피탈 계좌 수'); C('L21171100',capital&(age<=180),'180일 이내 개설 캐피탈 계좌 수')
 A('L21200200',cardloan&unsecured,'카드업권 무담보 카드론 잔액')
 C('L21211300',savings&(age<=365),'365일 이내 개설 저축은행 계좌 수')
 C('L22000500',active&(age<=30),'30일 이내 개설 계좌 수'); C('L22000900',active&(age<=90),'90일 이내 개설 계좌 수')
 for h,threshold in [('L22001700',5000),('L22001900',10000),('L22002005',100000)]: C(h,active&(amounts<threshold),f'계좌 잔액 {threshold}천원 미만 계좌 수')
 for h,threshold in [('L22001800',5000),('L22002000',10000)]: A(h,active&(amounts<threshold),f'계좌 잔액 {threshold}천원 미만 잔액 합')
 for h,threshold in [('L22002011',30000),('L22002012',50000),('L22002013',10000)]: C(h,noncar&(amounts<threshold),f'신차할부 제외, 잔액 {threshold}천원 미만 계좌 수')
 A('L22002014',noncar&(amounts<10000),'신차할부 제외, 1천만원 미만 잔액 합')
 for h,days,threshold in [('L22002700',90,5000),('L22002800',90,10000),('L22002900',180,5000),('L22003000',180,10000),('L22003100',365,5000),('L22003200',365,10000)]: C(h,active&(age<=days)&(amounts<threshold),f'{days}일 이내 개설, 잔액 {threshold}천원 미만 계좌 수')
 C('L23001901',nonhouse,'주택담보 제외 미상환 계좌 수'); C('L23001909',nonhouse&(age<=90),'90일 이내 개설 주택담보 제외 계좌 수'); C('L23001911',nonhouse&(age<=180),'180일 이내 개설 주택담보 제외 계좌 수')
 AGE('L23001916',nonhouse,True,'주택담보 제외 계좌의 최근 개설 경과일'); AGE('L23003700',active,False,'현재 미상환 계좌의 가장 오래된 개설 경과일'); C('L2A000105',nonbank,'은행 제외 미상환 계좌 수')
 benefit=rng.choice(4,shape,p=[.86,.08,.04,.02])
 for h,b in [('LA0000038',1),('LA0000039',2),('LA0000040',3)]: C(h,unsecured&(benefit==b),f'가상 서민금융 상품 분류 {b} 미상환 계좌 수')
 AGE('LA0052602',private,False,'대부업권 최초 현재 계좌 개설 경과일')
 private_ever=private.any(1)
 add('LA0052601',np.where(private_ever,maxv(age,private),0),'일','현재 또는 과거 대부업 거래 최초 경과일, 현재 계좌보다 같거나 오래됨')
 A('LA0099212',private,'대부업 전체 잔액'); A('LA0099227',private&unsecured,'대부업 무담보 잔액')
 C('LC0000001',active,'전체 계좌 수, 교육용에서는 카드론도 계좌별 집계')
 C('LC0000002',unsecured,'전체 무담보 신용계좌 수'); C('LC0000021',unsecured&(benefit>0),'가상 서민금융 상품에 해당하는 신용계좌 수')
 I('LC0000101',standard,'담보유형 제외 조건 충족 계좌의 고유 기관 수'); A('LC0000202',unsecured,'전체 무담보 신용대출 잔액'); AGE('LC0000607',standard,False,'특정 담보 제외 계좌의 최초 개설 경과일')
 C('LC0017001',capital&np.isin(kind,[2,8]),'캐피탈 자동차 할부계좌 수'); A('LC0017201',capital&np.isin(kind,[2,8]),'캐피탈 자동차 할부 잔액')
 C('LC0021001',savings,'저축은행 계좌 수'); C('LC0021010',savings&~deposit,'저축은행 예적금담보 제외 계좌 수')
 I('LC0021102',savings&~(deposit|securities|house),'저축은행 특정 담보 제외 고유 기관 수'); I('LC0021103',savings&standard,'저축은행 특정 담보 및 신차 제외 고유 기관 수')
 add('LC0021602',np.where((savings&unsecured).any(1),np.minimum(rng.integers(0,61,n),maxv(age,savings&unsecured)),0),'일','현재 저축은행 신용계좌의 최근 상환 경과일, 계좌 개설 이전을 넘지 않으며 계좌 없으면 0')
 C('LC0025002',bank&unsecured,'은행 무담보 신용계좌 수'); C('LC0025018',bank&(kind==6),'은행 학자금 계좌 수'); A('LC0025202',bank&unsecured,'은행 무담보 신용잔액')
 C('LC0027001',nonbank,'비은행 전체 계좌 수'); C('LC0027002',nonbank&unsecured,'비은행 신용계좌 수'); C('LC0027010',nonbank&guarantee,'비은행 보증 담보계좌 수')
 C('LC0027021',nonbank&~propertycoll,'비은행 부동산담보 제외 계좌 수'); C('LC0027023',nonbank&standard,'비은행 특정 담보와 신차 제외 계좌 수')
 C('LC0099020',(savings|mutual)&~propertycoll,'저축은행과 상호금융의 부동산담보 제외 계좌 수'); C('LC0099024',nonbank&~mutual&~(newcar|deposit),'은행, 상호금융, 신차, 예적금담보 제외 계좌 수')
 tri=cardloan|savings|capital
 C('LC0099045',tri&noncar,'카드, 캐피탈, 저축은행의 신차 제외 계좌 수'); C('LC0099046',tri&standard,'3개 업권의 특정 담보와 신차 제외 계좌 수'); C('LC0099047',nonbank&unsecured,'비은행 무담보 신용계좌 수, 보증담보 제외')
 I('LC0099101',nonbank&standard,'비은행 특정 담보와 신차 제외 고유 기관 수'); I('LC0099103',nonbank&~mutual&standard,'은행과 조합 제외, 특정 담보와 신차 제외 고유 기관 수')
 add('LC0099901',pct(sumv(amounts,nonbank&standard),sumv(amounts,active)),'%','특정 담보와 신차 제외 비은행 잔액 / 전체 잔액, 분모 0이면 0')
 I('LC1200102',noncar&(age<=365),'1년 이내 개설, 신차 제외 고유 기관 수'); I('LC1221101',savings&~(deposit|securities)&(age<=365),'1년 이내 저축은행 예적금/유가증권담보 제외 고유 기관 수')
 add('LC2421801',(savings&unsecured&(age<=730)).any(1).astype(int),'0/1','24개월 내 현재 또는 가상 상환완료 저축은행 신용계좌 경험 여부')
 I('LE0000213',active,'전체 미상환 고유 기관 수'); AGE('LH0000013',savings,True,'저축은행 최근 계좌 개설 경과일')
 C('LH0000147',cardloan&(age<=365),'1년 이내 개설 카드업권 계좌 수'); C('LH0000151',capital&(age<=365),'1년 이내 개설 캐피탈 계좌 수'); AGE('LH0000154',cardloan&unsecured,True,'최근 카드론 개설 경과일')
 remain=rng.integers(6,121,shape); rate=np.clip(.035+.12*riskp[:,None]+rng.normal(0,.015,shape),.02,.195)
 annual=(amounts/np.maximum(remain,12)*12+amounts*rate).round().astype(np.int64)
 add('LRZ021201',sumv(annual,active),'천원/년','가상 잔여기간 기준 연간 원금상환액 + 현재잔액 기준 연간 이자, 교육용 근사')
 C('LS0000067',nonbank,'제2금융권을 비은행으로 정의한 계좌 수'); A('LS0000124',active&(amounts<20000),'계좌 잔액 2천만원 미만 잔액 합'); A('LS0000125',savings&(amounts<20000),'저축은행 2천만원 미만 잔액 합')
 C('LS0000176',nonbank&nonhouse&(age<=180),'6개월 이내 비은행 주택담보 제외 계좌 수'); C('LS0000180',nonbank&nonhouse&(age<=180)&(amounts<10000),'6개월 이내 비은행 주택담보 제외 1천만원 미만 계좌 수')
 C('LS0000574',savings&(age<=365),'1년 이내 개설 저축은행 현재 계좌 수')
 C('LS0000864',cardloan&unsecured&(age<=90),'3개월 이내 개설 카드업권 신용계좌 수'); C('LS0000866',capital&unsecured&(age<=90),'3개월 이내 개설 캐피탈 신용계좌 수'); C('LS0000892',savings&unsecured&(age<=365),'1년 이내 개설 저축은행 신용계좌 수'); C('LS0001144',active&(age<=7),'7일 이내 개설 계좌 수')
 for h,days,months in [('LS0001196',180,6),('LS0001197',365,12)]:
  old=np.round(amounts*(1+months/np.maximum(remain,12))).astype(np.int64)
  historical=sumv(old,savings&(age>days))  # no fabricated closed-loan history outside the ledger
  add(h,sumv(amounts,savings)-historical,'천원','현재 저축은행 잔액 - '+str(months)+'개월 전 가상 잔액, 음수는 정상 감소액')
 C('LU0024001',private,'대부업권 미상환 계좌 수로 재정의'); I('LU0024101',private,'대부업권 고유 기관 수'); A('LU0024201',private,'대부업권 미상환 잔액'); C('LU0624001',private&(age<=180),'6개월 이내 개설 대부업 계좌 수')

 # Card accounts and a shared 12-month usage ledger, month zero is most recent.
 card_count=plan.card_count.to_numpy(dtype=int); ca=np.arange(8)[None,:]<card_count[:,None]
 card_age=1+(ledger_rng.random((n,8))*np.maximum(horizon[:,None]-1,1)).astype(int)
 card_age=np.minimum(card_age,horizon[:,None]); card_age[:,0]=horizon
 card_inst=rng.integers(1,9,(n,8)); cc_active=ca.copy()
 active_cards=cnt(cc_active); has_card=active_cards>0
 card_limit=np.clip(ref_limit/np.median(cr['limit_NTD_quantiles'])*8000*rng.lognormal(0,.25,n),500,70000)
 card_limit=np.where(has_card,card_limit,0)
 available=np.column_stack([(cc_active&(card_age>30*m)).any(1) for m in range(12)])
 monthly_util=np.empty((n,12)); monthly_util[:,0]=util
 for m in range(1,12): monthly_util[:,m]=np.clip(.75*monthly_util[:,m-1]+.25*util+rng.normal(0,.08,n),0,1.8)
 spend=card_limit[:,None]*np.clip(monthly_util,.005,1.8)*rng.uniform(.16,.42,(n,12))*available
 spend*=rng.random((n,12))>.12
 sparse_use=np.zeros((n,12),dtype=bool)
 for i in np.flatnonzero(sparse):
  k=int(plan.iloc[i].sparse_usage_months)
  if k: sparse_use[i,ledger_rng.choice(12,k,replace=False)]=True
 spend[sparse] *= sparse_use[sparse]
 cash_on=(rng.random((n,12))<(0.05+.45*riskp[:,None]))&available
 cash=spend*rng.uniform(.1,.6,(n,12))*cash_on
 cash_only=cash_on&(rng.random((n,12))<.14)
 cash=np.where(cash_only,spend,cash)
 installment_fraction=rng.uniform(.08,.38,(n,12))
 installment_fraction=np.where(rng.random((n,12))<.12,1.,installment_fraction)
 installment_fraction=np.where(rng.random((n,12))<.12,0.,installment_fraction)
 installment=(spend-cash)*installment_fraction; single=np.maximum(0,spend-cash-installment)
 debit=rng.lognormal(5.2,.7,(n,12))*(rng.random((n,12))>.15)
 # Account-level usage; only cards open in a 30-day window may receive use.
 account_available=ca[:,:,None] & (card_age[:,:,None]>30*np.arange(12)[None,None,:])
 account_single,account_installment,account_cash=allocate_card_components(
  single,installment,cash,account_available,card_rng.lognormal(0,.7,(n,8,12)))
 account_spend=account_single+account_installment+account_cash
 main_card,qualifying_cards,_,_,cash_institutions=card_subsets(
  account_single,account_installment,account_cash,card_inst)
 # Match the bundled academy generator's customer-level synthetic subset rules
 # for shared legacy columns. The account ledger remains the source for raw use.
 main_share=compat_rng.uniform(.45,.95,(n,1))
 main_participation=(active_cards[:,None]<=1)|(compat_rng.random((n,12))>.13)
 main_single=single*main_share*main_participation
 main_cash=cash*main_share*main_participation
 main_inst=installment*main_share*main_participation
 qualifying_customer=spend[:,0]>=300
 qual_share=compat_rng.uniform(.3,.95,(n,1))*qualifying_customer[:,None]
 qual_participation=compat_rng.random((n,12))>.18
 qual_single=single*qual_share*qual_participation
 qual_cash=cash*qual_share*qual_participation
 qual_inst=installment*qual_share*qual_participation
 def ratio(h,num,den,w): add(h,pct(num[:,:w].sum(1),den[:,:w].sum(1)),'%','최근'+str(w)+'개월 해당 사용금액 / 전체 사용금액 ×100, 분모 0이면 0','가상 월별 카드 이용원장')
 def months(h,arr,w,threshold=0): add(h,((arr[:,:w]>=threshold) if threshold>0 else (arr[:,:w]>0)).sum(1),'개월',str(w)+'개월 중 금액 '+str(threshold)+('천원 이상' if threshold>0 else '천원 초과')+' 사용 개월 수','가상 월별 카드 이용원장')
 add('C00000001',cnt(cc_active&(card_age<=1095)),'건','최근 3년 개설된 현재 미해지 카드 수')
 add('C00000023',cnt(cc_active&(card_age<=365)),'건','1년 내 미해지 카드 및 추가 가상 예금/체크 계좌 수')
 add('C00000035',minv(card_age,cc_active),'일','현재 미해지 카드 중 최근 개설 경과일, 없으면 0')
 add('C00000052',cnt(cc_active&(card_age<=1825))+cnt(active&(age<=1825)),'건','5년 내 카드, 대출, 추가 예금의 미해지 신용개설 수')
 add('C00000090',maxv(card_age,ca),'일','전체 카드 최초 개설 경과일, 없으면 0'); add('C00000093',minv(card_age,ca),'일','전체 카드 최근 개설 경과일, 없으면 0'); add('C11061000',maxv(card_age,cc_active),'일','현재 미해지 카드 최초 개설 경과일, 없으면 0')
 for h,days in [('CA1200001',365),('CA2400001',730),('CA3600001',1095)]: add(h,unique_count(card_inst,ca&(card_age<=days)),'기관',str(days)+'일 내 카드 개설 고유 기관 수')
 add('CE0000004',pct(cnt(ca&(card_age<=365)),cnt(ca)),'%','최근 1년 발급 카드 수 / 전체 발급 카드 수, 없으면 0')
 ratio('CF0100902',single,spend,1); ratio('CF0100906',single+installment+debit,spend+debit,1); ratio('CF0100919',single+debit,spend+debit,1); ratio('CF0100932',cash,spend,1)
 months('CF0300611',cash,3); ratio('CF0300902',single+installment,spend,3); months('CF0331605',main_cash,3); months('CF0332605',qual_cash,3)
 months('CF0600157',cash,6,200); months('CF0600611',cash,6); months('CF0600615',cash,6,300); ratio('CF0600913',single+installment+debit,spend+debit,6); ratio('CF0600943',cash,spend,6)
 months('CF0631605',main_cash,6); months('CF0632605',qual_cash,6); months('CF1200619',spend,12); months('CF1200620',single,12); months('CF1200622',single+installment,12); ratio('CF1200902',single+installment,spend,12); ratio('CF1200946',cash,spend,12)
 for prefix,arrs in [('CF123160',[main_single+main_inst+main_cash,main_single,main_single+main_inst,main_cash]),('CF123260',[qual_single+qual_inst+qual_cash,qual_single,qual_single+qual_inst,qual_cash])]:
  for suffix,arr in zip(['1','2','4','5'],arrs): months(prefix+suffix,arr,12)
 before=single[:,3:6].sum(1); now=single[:,:3].sum(1)
 growth=np.divide((now-before)*100,before,out=np.zeros(n),where=before>0)
 add('CF9900907',np.round(growth,2),'%','최근3개월 일시불액 / 직전3개월 일시불액의 일반 증감률, 기준금액 0이면 교육용 0')
 open6=available[:,:6]&has_card[:,None]; open6_n=open6.sum(1)
 add('CL0631905',np.round(np.divide((monthly_util[:,:6]*open6).sum(1),open6_n,out=np.zeros(n),where=open6_n>0)*100,2),'%','고객 단위 이용률의 최근6개 30일 구간 평균; 카드가 개설돼 있던 구간만 분모에 포함(6개 구간이 모두 개설 상태면 기존 207열 생성기와 동일), 카드 없으면 0','UCI 대만 한도 대비 명세 잔액 분포')
 cash_limit=card_limit*.4
 add('CL0631906',pct(cash[:,:6].mean(1),cash_limit),'%','최근6개월 평균 현금서비스 금액 / 가상 현금서비스 한도, 카드 없으면 0')
 add('CS0000050',np.minimum(active_cards,np.where(cash[:,0]>0,1+compat_rng.poisson(.3,n),0)),'기관','기존 207열 생성기와 호환: 최근월 현금서비스가 있으면 1+Poisson(0.3), 활성카드 수로 상한; 실제 기관 ID 고유 개수는 아님')

 # Shared historical delinquency events, all start before the observation date.
 E=10; event_n=np.clip(rng.poisson(.12+2.8*late_share+.25*riskp,n),0,E)
 ev=np.arange(E)[None,:]<event_n[:,None]
 event_account=np.zeros((n,E),dtype=int)
 event_is_card=np.zeros((n,E),dtype=bool)
 event_horizon=np.zeros((n,E),dtype=int)
 event_sector=np.zeros((n,E),dtype=int)
 event_exposure=np.zeros((n,E),dtype=int)
 for i in range(n):
  total=int(loan_num[i]+card_count[i])
  if total==0:
   ev[i]=False
   continue
  pick=ledger_rng.integers(0,total,E); event_is_card[i]=pick>=loan_num[i]
  for j,k in enumerate(pick):
   if k<loan_num[i]:
    event_account[i,j]=k;event_horizon[i,j]=age[i,k];event_sector[i,j]=sector[i,k];event_exposure[i,j]=amounts[i,k]
   else:
    k-=loan_num[i];event_account[i,j]=k;event_horizon[i,j]=card_age[i,k];event_sector[i,j]=1;event_exposure[i,j]=int(card_limit[i])
 start=(ledger_rng.random((n,E))*np.maximum(event_horizon,1)).astype(int)
 # At most one event per account in this compact scenario ledger.
 for i in range(n):
  seen=set()
  for j in range(E):
   key=(bool(event_is_card[i,j]),int(event_account[i,j]))
   if key in seen:
    ev[i,j]=False
   elif ev[i,j]:
    seen.add(key)
   if event_is_card[i,j] and ev[i,j]:
    used=np.flatnonzero((account_spend[i,event_account[i,j]]>0)&(30*np.arange(12)<event_horizon[i,j]))
    if not len(used):
     ev[i,j]=False
    else:
     offset=int(ledger_rng.choice(used))
     start[i,j]=min(30*offset+int(ledger_rng.integers(0,30)),event_horizon[i,j]-1)
 # Sparse users with no observed usage have no simulated delinquency in this reduced ledger.
 ev[sparse & (spend.sum(1)==0)]=False
 duration=np.clip(np.rint(rng.gamma(1.7,18,(n,E))*(1+.5*riskp[:,None])),1,240).astype(int)
 duration=np.minimum(duration,start+1)
 end=np.maximum(start-duration,0); ongoing=ev&(start<duration); resolved=ev&~ongoing
 evsector=event_sector; private_ev=ev&(evsector==4); financial_ev=ev&(evsector!=4)
 evamount=np.minimum(np.maximum(10,np.round(rng.lognormal(6.5,1.0,(n,E)))).astype(np.int64),event_exposure)
 product=rng.integers(0,5,(n,E)); reg=ev&(duration>=90)&(rng.random((n,E))<.7)
 def event_count(h,mask,rule): add(h,cnt(mask),'건',rule,'가상 과거 연체사건 원장')
 def event_max(h,mask,rule): add(h,maxv(duration,mask),'일',rule+'; 사건 없으면 0','가상 과거 연체사건 원장')
 event_count('B12000100',reg,'가상 90일 이상 신용관리/공공 등록 사건 수')
 event_count('B22000200',reg&ongoing,'등록 사건 중 현재 미해제 건수'); add('B22000300',sumv(evamount,reg&ongoing),'천원','현재 미해제 등록 연체금액 합')
 add('B32000100',cnt(reg),'건','현재 합성 원장에서는 B12000100과 동일한 신용관리 등록 사건 수로 생성됨; 별도 금융질서문란 사건 원장은 모델링하지 않음')
 add('BS0000164',((reg.any(1))&(rng.random(n)<.25)).astype(int),'0/1','등록 이력이 있는 가상 고객의 신용회복지원 여부')
 event_count('BS0000772',reg&resolved&(end<=1825),'5년 내 해제 등록 사건 수'); event_count('BS0000930',reg&resolved&(end<=365),'1년 내 해제 등록 사건 수')
 event_count('DQ0052001',private_ev&ongoing&(duration>=30),'대부업 30일 이상 현재 미해제 연체')
 for h,w in [('DQ0152001',30),('DQ0352001',90),('DQ0652001',180),('DQ1252001',365)]: event_count(h,private_ev&(duration>=30)&(end<=w),f'대부업 30일 이상 연체 중 최근 {w}일과 겹치는 사건 수')
 for h,w in [('DQ0352601',90),('DQ0652601',180),('DQ1252601',365)]: event_max(h,private_ev&(duration>=30)&(end<=w),f'대부업 30일 이상 최근 {w}일 연체 최장기간')
 event_count('DQ1200001',ev&(duration>=30)&(end<=365),'금융업/대부업 30일 이상 최근1년 연체 수'); event_count('DQ1251001',financial_ev&(duration>=30)&(end<=365),'금융업 30일 이상 최근1년 연체 수')
 event_count('DQ1251011',financial_ev&(duration>=60)&(end<=365),'금융업 60일 이상 최근1년 연체 수'); event_count('DQ1252004',private_ev&(duration>=60)&(end<=365),'대부업 60일 이상 최근1년 연체 수')
 for h,w in [('KC5000016',90),('KC5000017',180)]: event_max(h,ev&(end<=w),f'최근 {w}일 연체 최장기간')
 for h,w in [('KC5000019',90),('KC5000020',180),('KC5000021',365)]: add(h,unique_count(product,ev&(end<=w)),'과목',f'최근 {w}일 연체가 있는 가상 금융과목 수, 0~5')
 event_count('P27000100',ongoing,'현재 미해제 연체 사건 수')
 event_max('P3O000500',resolved&(end<=365),'최근1년 내 해제 사건의 최장 연체기간'); add('P3O003900',minv(end,resolved&(end<=365)),'일','최근1년 내 해제 사건의 최근 해제 경과일, 없으면 0'); add('P44003901',minv(end,resolved),'일','모든 과거 해제 사건의 최근 해제 경과일, 없으면 0')
 event_max('PE0000025',ev&(end<=90),'최근3개월 연체 최장기간'); event_max('PE0000026',ev&(end<=180),'최근6개월 연체 최장기간')
 add('PH0000092',sumv(evamount,ev&(end<=90)),'천원','최근3개월과 겹치는 연체 사건 금액 합')
 event_count('PS0000090',ev&(duration>=30)&(start<=180),'최근6개월 최초 발생한 30일 이상 연체 수')
 event_count('PS0000279',resolved&(duration>=20)&(end<=90),'최근3개월 내 해제된 20일 이상 연체 수'); event_count('PS0000282',resolved&(duration>=20)&(end<=180),'최근6개월 내 해제된 20일 이상 연체 수'); event_max('PS0000500',resolved&(end<=180),'최근6개월 내 해제된 사건의 최장 연체기간')
 for h,w in [('PS0001894',30),('PS0001895',90),('PS0001896',180),('PS0001897',365)]: event_count(h,ev&(end<=w)&(evamount>=100),f'최근 {w}일과 겹치는 10만원 이상 연체 사건 수')
 adverse=rng.integers(1,7,(n,E)); adverse_mask=ev&(duration>=60)&(start<=365)
 for i,h in enumerate(['LA1200017','LA1200018','LA1200019','LA1200020','LA1200021','LA1200022'],1): event_count(h,adverse_mask&(adverse==i),f'최근1년 60일 이상 연체 사건에 배정된 상호배타적 계좌상태 {i} 경험 수')
 event_count('LA6000005',resolved&(duration>=60)&(end<=1825)&(adverse==3),'최근 5년 내 해제된 60일 이상 양도해지 상태 사건 수')

 # Guarantees and credit provision are aggregated consistently with the loan ledger.
 guarantee_num=np.zeros(n,dtype=int); ga=np.arange(4)[None,:]<guarantee_num[:,None]; gs=rng.choice(4,(n,4),p=[.55,.15,.12,.18]); gamt=rng.integers(500,30000,(n,4))
 add('G00000001',cnt(ga),'건','전체 현재 가상 보증 수'); add('G00010001',cnt(ga&(gs==0)),'건','은행업권 보증 수'); add('G00060001',cnt(ga&(gs==1)),'건','카드업권 보증 수'); add('GU0024001',cnt(ga&(gs==2)),'건','대부업권 보증 수')
 add('IDT000003',rng.integers(0,7301,n),'일','최근 거주 정보 등록 이후 경과일, 교육용 독립 거주이력')
 add('KC1000001',sumv(amounts,active)+sumv(gamt,ga)+np.round(card_limit).astype(np.int64),'천원','교육용 총신용공여 = 현재 대출잔액 + 보증금액 + 카드한도')
 add('KC1000025',cnt(active)+cnt(ga)+active_cards,'건','교육용 총신용공여 건수 = 대출계좌 + 보증 + 활성카드 수')
 observed_months=(spend>0).sum(1)
 score_available=(~nofile)&(~sparse)&(horizon>=180)
 grade=np.clip(np.rint(3+.45*np.log1p(loan_num)+.015*result['CL0631905']+.5*result['DQ1200001']+rng.normal(0,.5,n)),1,10).astype(int)
 grade=np.where(score_available,grade,5)  # compatibility placeholder, masked in model view
 result['PRE_RT']=np.where(score_available,result['PRE_RT'],0.0)
 result['PRE_LMT']=np.where(score_available,result['PRE_LMT'],0)
 add('CB',grade,'교육용등급 1~10','clip(rint(3 + 0.45*log1p(loan_num) + 0.015*CL0631905 + 0.5*DQ1200001 + N(0,0.5)), 1, 10). riskp는 이 식에 직접 들어가지 않음. score_available이 거짓이면 호환용 5를 저장하며 NICE 등급이 아님.')
 add('SP',(result['DQ1200001']>0).astype(int),'0/1','최근1년 30일 이상 연체 경험 여부로 재정의, NICE SP스코어 아님')
 # Future outcome is generated after all predictors, with independent random noise.
 logit=.65*risk+.20*result['DQ1200001']+.10*np.log1p(loan_num)+rng.normal(0,.65,n)
 lo,hi=-20.,20.
 for _ in range(60):
  mid=(lo+hi)/2
  if expit(logit+mid).mean()>target_rate: hi=mid
  else: lo=mid
 p=expit(logit+(lo+hi)/2)
 future_exposure=np.where(nofile,ledger_rng.random(n)<no_credit_exposure_probability,np.where(sparse,ledger_rng.random(n)<sparse_history_exposure_probability,True))
 positive=(rng.random(n)<p)&future_exposure
 severity=1+rng.binomial(11,np.clip(.035+.22*riskp,0,.5),n)
 target=np.where(positive,severity,0)
 add('결과값(연체회차)',target,'0~12회','관측일 이후 가상 12개월 중 연체가 발생한 월 수, 목표 양성비율 10%의 교육용 시나리오')
 meta['결과값(연체회차)']['as_of']='2026-09-19~2027-09-18 가상 미래 결과'

 for h in ['PRE_LMT','PRE_RT','INA_CD','LU0024001','CB','SP','결과값(연체회차)']:
  meta[h]['teaching_definition']={'PRE_LMT':'가상 신규대출 제시 한도','PRE_RT':'가상 신규대출 제시 연이율','INA_CD':'월 약정 납입일','LU0024001':'대부업권 현재 미상환 계좌 수','CB':'교육용 위험등급','SP':'최근1년 30일 이상 연체 경험 여부','결과값(연체회차)':'관측일 이후 가상 12개월의 연체 발생 월 수'}[h]
 for h in meta:
  if h.startswith('LC'): meta[h]['teaching_definition']=meta[h]['teaching_definition'].replace('(카드론인별기준)','(교육용 계좌별 기준)')
  if h.startswith('CF') and '이용률' in meta[h]['teaching_definition']: meta[h]['teaching_definition']+=' [교육용 금액 구성비 기준]'
  meta[h]['data_type']='string' if result[h].dtype.kind in 'USO' else 'double' if result[h].dtype.kind=='f' else 'long'
 assert set(result)==set(prior['headers']),{'missing':set(prior['headers'])-set(result),'extra':set(result)-set(prior['headers'])}
 df=pd.DataFrame({h:result[h] for h in prior['headers']})
 summary={'rows':n,'columns':len(df.columns),'seed':seed,'all_values_synthetic':True,'target_positive_design_rate':target_rate,'target_positive_observed_rate':float(positive.mean()),'target_positive_count':int(positive.sum()),'snapshot_date':'2026-09-18','future_target_period':'2026-09-19~2027-09-18','reference_sources':[cr['url'],gr['url']],'ref_logistic_test_auc':rm['reference_test_auc']}
 # Export event/account ledgers so independent checks do not rely on generation assertions.
 loan_rows=[]; card_rows=[]; event_rows=[]; usage_rows=[]; account_usage_rows=[]
 for i,cid in enumerate(plan.customer_id):
  for j in np.flatnonzero(active[i]):
   loan_rows.append(dict(customer_id=cid,account_id=f'{cid}_L{j}',sector=int(sector[i,j]),kind=int(kind[i,j]),institution_id=int(inst[i,j]),balance_thousand=int(amounts[i,j]),age_days=int(age[i,j]),remaining_months=int(remain[i,j]),annual_rate=quantize_rate(rate[i,j]),annual_service_thousand=int(annual[i,j])))
  for j in np.flatnonzero(ca[i]):
   card_rows.append(dict(customer_id=cid,account_id=f'{cid}_C{j}',institution_id=int(card_inst[i,j]),age_days=int(card_age[i,j]),active=int(cc_active[i,j])))
   for month in range(12):
    account_usage_rows.append(dict(customer_id=cid,account_id=f'{cid}_C{j}',institution_id=int(card_inst[i,j]),month_offset=month,available=int(account_available[i,j,month]),is_main_card=int(j==main_card[i]),qualifies_latest_300=int(qualifying_cards[i,j]),spend_thousand=float(account_spend[i,j,month]),single_thousand=float(account_single[i,j,month]),installment_thousand=float(account_installment[i,j,month]),cash_thousand=float(account_cash[i,j,month])))
  for j in np.flatnonzero(ev[i]):
   event_rows.append(dict(customer_id=cid,event_id=f'{cid}_E{j}',account_id=f'{cid}_{"C" if event_is_card[i,j] else "L"}{event_account[i,j]}',start_days_ago=int(start[i,j]),end_days_ago=int(end[i,j]),duration_days=int(duration[i,j]),amount_thousand=int(evamount[i,j]),sector=int(evsector[i,j]),ongoing=int(ongoing[i,j]),registered=int(reg[i,j]),product=int(product[i,j])))
  for j in range(12):
   usage_rows.append(dict(customer_id=cid,month_offset=j,available=int(available[i,j]),spend_thousand=float(spend[i,j]),cash_thousand=float(cash[i,j]),single_thousand=float(single[i,j]),installment_thousand=float(installment[i,j]),debit_thousand=float(debit[i,j]),statement_utilization_pct=float(monthly_util[i,j]*100)))
 availability=pd.DataFrame(dict(customer_id=plan.customer_id,credit_history_days=horizon,credit_card_count=card_count,current_loan_count=loan_num,credit_card_observed_months=observed_months,cb_available=score_available.astype(int),future_credit_exposure=future_exposure.astype(int),target_design_probability=p*future_exposure,cohort=cohort,age=age_years))
 summary.update(generator_revision='3.0.1',card_usage_schema='account_monthly_v1',income_revision='randomized_debt_ties_v2117',target_positive_observed_rate=float(positive.mean()),target_positive_count=int(positive.sum()),design_rate_before_future_exposure=target_rate,thinfile_definition='project simulation scenarios, not official eligibility',label_origin='new scenario, not original academy labels')
 for h in ['CB','PRE_RT','PRE_LMT']:
  if h=='CB':
   meta[h]['generation_rule']='v2.5: '+meta[h]['generation_rule']+' unavailable rows use compatibility placeholder CB=5 in base_207 and are masked in model_inputs. See THINFILE.md.'
  else:
   meta[h]['generation_rule']='v2.5: unavailable masked in model_inputs; base_207 uses compatibility placeholders (CB=5, offer=0). See THINFILE.md.'
 for h in ['CF0331605','CF0631605','CF1231601','CF1231602','CF1231604','CF1231605']:
  meta[h]['generation_rule'] += '; v3.0.0: legacy-compatible customer-level main-use share (45~95%) and monthly participation rule'
 for h in ['CF0332605','CF0632605','CF1232601','CF1232602','CF1232604','CF1232605']:
  meta[h]['generation_rule'] += '; v3.0.0: legacy-compatible customer latest-month total >=300 thousand KRW; qualifying subset uses 30~95% share and monthly participation'
 meta['CS0000050']['teaching_definition']='최근월 현금서비스 이용 시 기존 207열 생성기와 같은 포아송 기반 기관 수 대용치; 실제 기관 ID 고유 개수와 다를 수 있음'
 for h in meta:
  meta[h]['generation_context']='v3.0.0 separate RNG streams; v2.5 scenario: account presence, ages and events constrained before aggregation; see THINFILE.md and saved ledgers'
 for h in ['C00000023','C00000052']:
  meta[h]['generation_rule']='aggregate current ledger accounts within window; no additional deposit/check accounts in v2.5 scenario'
 meta['CL0631905']['generation_rule']='customer-level utilization averaged over the recent six 30-day windows in which at least one card was open (equals the legacy all-six mean when all six are open); no-card customer gets 0 and model view masks unavailable history'
 ledgers={'loans':pd.DataFrame(loan_rows),'cards':pd.DataFrame(card_rows),'delinquencies':pd.DataFrame(event_rows),'card_monthly':pd.DataFrame(usage_rows),'card_account_monthly':pd.DataFrame(account_usage_rows,columns=['customer_id','account_id','institution_id','month_offset','available','is_main_card','qualifies_latest_300','spend_thousand','single_thousand','installment_thousand','cash_thousand']),'availability':availability}
 return df,[meta[h] for h in prior['headers']],summary,ledgers

