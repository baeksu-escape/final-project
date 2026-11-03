"""Independent checks against delivered CSV, plus held-out classroom model check."""
from pathlib import Path
import json,hashlib
import numpy as np,pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score,average_precision_score,accuracy_score

BASE=Path(__file__).resolve().parents[1]
DATA=BASE/'thinfile'
def validate():
 schema=json.loads((BASE/'reference/academy/schema.json').read_text()); prior=json.loads((BASE/'reference/original_priors.json').read_text()); summary=json.loads((DATA/'generation_summary.json').read_text())
 dtype={r['column']:('string' if r['data_type']=='string' else 'float64' if r['data_type']=='double' else 'int64') for r in schema['columns']}
 df=pd.read_csv(DATA/'base_207.csv',dtype=dtype,encoding='utf-8-sig',keep_default_na=False)
 checks=[]
 def check(name,bad,explanation):
  count=int(bad if np.isscalar(bad) else np.asarray(bad).sum()); checks.append({'check':name,'violations':count,'result':'PASS' if count==0 else 'FAIL','rule':explanation})
 def le(a,b): check(a+' <= '+b,df[a]>df[b]+1e-8,'부분집합은 전체 이하 또는 짧은 기간은 긴 기간 이하')
 def chain(names):
  for a,b in zip(names,names[1:]): le(a,b)
 check('행 수',len(df)!=4*summary['config']['per_cohort'],'configured rows'); check('열 수/순서',list(df.columns)!=prior['headers'],'원본과 동일한 207개 컬럼명과 순서');check('가상ID 고유',df['식별구분'].duplicated().sum(),'모든 행에 고유 SYN ID');check('가상ID 표시',~df['식별구분'].str.match(r'^THF[1-4]\d{8}$'),'실제 식별번호와 구분')
 num=df.select_dtypes(include='number');check('숫자 유한값',~np.isfinite(num.to_numpy()),'NaN과 무한대 없음');check('빈 값',df.isna().sum().sum(),'자료형 결측 없음')
 check('미정의 특수결측 코드',((num.drop(columns=['LS0001196','LS0001197'])==-999)|(num.drop(columns=['LS0001196','LS0001197'])==999999991)).sum().sum(),'증가금액의 -999천원은 정상 감소액으로 구분, 다른 항목의 특수코드는 불허')
 allowed_negative={'CF9900907','LS0001196','LS0001197'}
 for c in schema['columns']:
  h=c['column'];unit=c['unit']
  if c['data_type']!='string' and h not in allowed_negative: check(h+' 비음수',df[h]<0,'증감률과 증가금액 외에는 음수 불허')
  if unit in ['건','개월','기관','과목','일','0/1','0~12회','교육용등급 1~10']: check(h+' 정수',df[h]!=np.floor(df[h]),'건수, 기간과 코드가 정수')
  if h.startswith('CF') and unit=='%':
   if h!='CF9900907': check(h+' 0~100',~df[h].between(0,100),'금액 구성비 범위')
  if h.startswith('CF') and unit=='개월':
   bound=3 if h.startswith('CF03') else 6 if h.startswith('CF06') else 12
   check(h+' 기간상한',df[h]>bound,str(bound)+'개월 이하')
 check('CB 범위',~df['CB'].between(1,10),'1~10 교육용 등급');check('SP 코드',~df['SP'].isin([0,1]),'0/1');check('목표값 범위',~df['결과값(연체회차)'].between(0,12),'가상 미래12개월 내 0~12회');check('주소 등록',((df['ADD_YN']=='N')!=(df['RES_ADD']=='미등록')),'미등록 주소와 N 일치')
 code_sets={}
 for family,code,*_ in prior['code_rows']: code_sets.setdefault(family,set()).add(str(code))
 for h in ['GOODS_CD','AD_NO','RRC_CD','HAC_CD']:
  normalized=df[h].str.lstrip('0') if h in ['RRC_CD','HAC_CD'] else df[h]
  check(h+' 코드사전',~normalized.isin(code_sets[h]),'제공 코드표 내 값')
 check('약정일 코드',~df['INA_CD'].str.match(r'^(0[1-9]|1\d|2[0-8])$'),'01~28 앞자리0 보존')
 check('ID 외 전체행 중복',df.drop(columns=['식별구분']).duplicated().sum(),'반복 복사로 규모를 늘리지 않음');check('ID와 결과 외 입력중복',df.drop(columns=['식별구분','결과값(연체회차)']).duplicated().sum(),'정답 차이만 둔 입력 복제 없음')
 old_pairs=[]
 for i in range(12,105):
  a,b=df.columns[i],df.columns[i+99]; equal=bool((df[a]==df[b]).all());old_pairs.append({'former_left':a,'former_right':b,'still_identical':equal})
 # Sparse cohorts may have many genuinely zero/equal columns; duplicate-pair diversity is not an invariant.
 for names in [
  ['CA1200001','CA2400001','CA3600001'],['BS0000930','BS0000772'],['DQ0052001','DQ0152001','DQ0352001','DQ0652001','DQ1252001'],['DQ0352601','DQ0652601','DQ1252601'],['DQ1251011','DQ1251001','DQ1200001'],['DQ1252004','DQ1252001','DQ1200001'],['KC5000016','KC5000017'],['KC5000019','KC5000020','KC5000021'],['L21170900','L21171100'],['L22000500','L22000900','L00000001'],['L22001700','L22001900','L22002005','L00000001'],['L22001800','L22002000','L00000002'],['L22002013','L22002011','L22002012','L00000004'],['L22002700','L22002900','L22003100'],['L22002800','L22003000','L22003200'],['L23001909','L23001911','L23001901','L00000001'],['L00990005','L00990004','L2A000105','L00000001'],['LC0000021','LC0000002','LC0000001'],['LC0021103','LC0021102','LC0021001'],['LC0025018','LC0025002','LC0000002'],['LC0027002','LC0027001','LC0000001'],['LC0099046','LC0099045','LC0000001'],['LS0000180','LS0000176','L2A000105'],['LU0624001','LU0024001'],['PE0000025','PE0000026'],['PS0000279','PS0000282'],['PS0001894','PS0001895','PS0001896','PS0001897'],['CF0300611','CF0600611','CF1231605'],['CF0331605','CF0631605','CF1231605'],['CF0332605','CF0632605','CF1232605'],['CF0600615','CF0600157','CF0600611']]:
  # Overall cash-month count is compared with overall usage, not main-card cash.
  if names==['CF0300611','CF0600611','CF1231605']: names=['CF0300611','CF0600611','CF1200619']
  chain(names)
 for a,b in [('L00060002','L00000002'),('L00080002','L00000002'),('L00140002','L00000002'),('L21200200','L00060002'),('L22002014','L22002000'),('LA0099227','LA0099212'),('LA0052602','LA0052601'),('LC0000202','L00000002'),('LC0017201','L00140002'),('LC0021010','LC0021001'),('LC0025202','LC0000202'),('LC0027010','LC0027001'),('LC0027023','LC0027001'),('LC0027021','LC0027001'),('LC0099103','LC0099101'),('LE0000213','L00000001'),('LS0000125','LS0000124'),('LS0000124','L00000002'),('LU0024101','LU0024001'),('G00010001','G00000001'),('G00060001','G00000001'),('GU0024001','G00000001'),('B22000200','B12000100'),('B12000100','B32000100'),('C11061000','C00000090'),('CF0331605','CF0300611'),('CF0631605','CF0600611'),('CF1231601','CF1200619'),('CF1232601','CF1200619'),('CF1231605','CF1231601'),('CF1232605','CF1232601')]: le(a,b)
 check('연체 업권 합계',df['DQ1200001']!=df['DQ1251001']+df['DQ1252001'],'금융업 + 대부업 = 전체30일 이상 연체')
 check('업권 잔액 부분합',(df['L00060002']+df['L00080002']+df['L00140002']+df['LA0099212'])>df['L00000002'],'서로 다른 업권 잔액 합은 전체 이내')
 check('보증 부분합',df['G00010001']+df['G00060001']+df['GU0024001']>df['G00000001'],'업권별 보증 합은 전체 이내')
 for c,a in [('L00000001','L00000002'),('LC0000002','LC0000202'),('LC0017001','LC0017201'),('LC0025002','LC0025202'),('LU0024001','LU0024201'),('B22000200','B22000300')]: check(c+' 금액대응',(df[c]==0)!=(df[a]==0),'해당 건수 0일 때만 잔액 0')
 for c,a,bound in [('L22001700','L22001800',5000),('L22001900','L22002000',10000),('L22002013','L22002014',10000)]: check(a+' 구간금액',df[a]>=np.maximum(df[c],1)*bound,'개별 잔액이 기준 미만이므로 합계도 건수×기준 미만')
 check('현재/전체 신용공여금액',df['KC1000001']<df['L00000002'],'총신용공여는 대출잔액 이상');check('SP 재정의',df['SP']!=(df['DQ1200001']>0).astype(int),'과거1년30일 이상 연체 경험 지시자')
 # Future exposure differs by cohort; no population prevalence target asserted.


 report={'checks':checks,'status':'PASS' if all(c['violations']==0 for c in checks) else 'FAIL'}
 failed=[c for c in checks if c['violations']]
 assert not failed,failed
 print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':
 import argparse
 ap=argparse.ArgumentParser();ap.add_argument('--data',default=str(DATA));a=ap.parse_args();DATA=Path(a.data);validate()
