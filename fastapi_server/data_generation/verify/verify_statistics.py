from pathlib import Path
import csv,io,json,hashlib,openpyxl
root=Path(__file__).resolve().parents[1]
src=root/'reference/statistics'
keys=['연령대별_소득_','소득구간별_가구당','2025년+가계']
names={k:next(p for p in src.iterdir() if k in p.name) for k in keys}
def rows(k):
 b=names[k].read_bytes()
 try:t=b.decode('utf-8-sig')
 except UnicodeDecodeError:t=b.decode('cp949')
 return list(csv.reader(io.StringIO(t)))
a=rows(keys[0]);wage=[]
for lo in range(20,70,10):
 g=f'{lo}~{lo+9}세';v={r[1]:float(r[-1]) for r in a if r[0]==g}
 assert v['평균소득']>=v['중위소득']
 wage.append(dict(age_min=lo,age_max=lo+9,mean_monthly_krw=v['평균소득']*10000,median_monthly_krw=v['중위소득']*10000))
b=rows(keys[1]);expense=[]
for g in dict.fromkeys(r[0] for r in b[2:]):
 if g=='전체 평균':continue
 v={r[1]:float(r[5]) for r in b[2:] if r[0]==g} # Q2 2026 all households
 expense.append(dict(group=g,household_income=v['소득'],household_consumption=v['소비지출'],household_size=v['가구원수'],per_person_monthly_income=v['소득']/v['가구원수'],consumption_to_gross_income=v['소비지출']/v['소득']))
s=openpyxl.load_workbook(names[keys[2]],data_only=True)['통계표1~10']
assert s.cell(33,2).value=='1인'
assets={'household_type':'one_person','asset_year':2025,'income_year':2024,'mean_assets_10k_krw':s.cell(33,10).value,'mean_savings_10k_krw':s.cell(33,22).value,'mean_income_10k_krw':s.cell(33,118).value}
stats={'wage_year':2024,'wage':wage,'expense_period':'2026Q2','expense':expense,'assets':assets,'source_files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in names.values()}}
return_value = stats

expected=json.loads((root/'reference/statistical_priors.json').read_text())
assert return_value==expected
print('source cells, derived ratios and SHA256: PASS')
