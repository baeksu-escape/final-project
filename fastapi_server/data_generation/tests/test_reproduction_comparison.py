"""Regression tests for exact-money and tolerant-rate replay comparisons."""
import unittest
import pandas as pd
from verify.verify_thinfile import assert_reproduced

class ReplayTests(unittest.TestCase):
 def rejects(self,name,a,b):
  with self.assertRaises(AssertionError):assert_reproduced(name,pd.DataFrame(a),pd.DataFrame(b))
 def test_one_won(self):self.rejects('profiles',{'annual_income_krw':[1000000000]},{'annual_income_krw':[1000000001]})
 def test_fractional_won(self):self.rejects('profiles',{'annual_income_krw':[1000000000]},{'annual_income_krw':[1000000000.5]})
 def test_nullable_count(self):self.rejects('model_inputs',{'DQ1200001':[1.,None]},{'DQ1200001':[1.+1e-10,None]})
 def test_id(self):self.rejects('loans',{'account_id':['001']},{'account_id':['002']})
 def test_nan_zero(self):self.rejects('loans',{'annual_rate':[None,0.1]},{'annual_rate':[0.,0.1]})
 def test_small_float_roundoff(self):assert_reproduced('loans',pd.DataFrame({'annual_rate':[0.1,None]}),pd.DataFrame({'annual_rate':[0.1+1e-12,None]}))
 def test_material_rate_change(self):self.rejects('loans',{'annual_rate':[0.1]},{'annual_rate':[0.1001]})
 def test_unknown_numeric_exact(self):self.rejects('loans',{'new_field':[1.]},{'new_field':[1.+1e-10]})
 def test_order(self):self.rejects('loans',{'account_id':['a','b']},{'account_id':['b','a']})
if __name__=='__main__':unittest.main()
