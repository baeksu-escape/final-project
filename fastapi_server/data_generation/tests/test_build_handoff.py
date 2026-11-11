"""Fixed-fixture checks for tools/build_handoff.py: output-folder safety and strict column roles.
Uses temporary folders only; no generator is run and no project data is read."""
import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
import pandas as pd
from tools import build_handoff as bh


def bundle(folder, files):
    """A folder that looks exactly like a bundle written by the tool."""
    for rel, text in files.items():
        p = folder/rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text, encoding='utf-8')
    bh.write_marker(folder)


class OutputSafety(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.t = Path(self.tmp.name)
        self.pkg = self.t/'pkg'; (self.pkg/'docs').mkdir(parents=True)

    def tearDown(self):
        self.tmp.cleanup()

    def test_new_folder_is_fine(self):
        self.assertEqual(bh.prepare_output(self.t/'new', False, self.pkg), (self.t/'new').resolve())

    def test_inside_or_containing_package_refused(self):
        for p in (self.pkg, self.pkg/'docs'/'new_bundle', self.pkg/'anything', self.t):
            with self.assertRaises(ValueError):
                bh.prepare_output(p, True, self.pkg)

    def test_existing_without_overwrite_refused(self):
        out = self.t/'b'; bundle(out, {'a.csv': '1'})
        with self.assertRaises(FileExistsError):
            bh.prepare_output(out, False, self.pkg)
        self.assertTrue((out/'a.csv').exists())

    def test_folder_without_marker_untouched(self):
        out = self.t/'mine'; out.mkdir(); (out/'keep.txt').write_text('x')
        with self.assertRaises(FileExistsError):
            bh.prepare_output(out, True, self.pkg)
        self.assertTrue((out/'keep.txt').exists())

    def test_fake_or_empty_marker_does_not_delete_other_files(self):
        out = self.t/'fake'; out.mkdir(); (out/'keep.txt').write_text('x')
        (out/bh.MARKER).write_text('created by tools/build_handoff.py')            # old-style text marker
        with self.assertRaises(FileExistsError):
            bh.prepare_output(out, True, self.pkg)
        (out/bh.MARKER).write_text(json.dumps({'files': {}}))                      # valid JSON, lists nothing
        with self.assertRaises(FileExistsError):
            bh.prepare_output(out, True, self.pkg)
        self.assertTrue((out/'keep.txt').exists())

    def test_extra_or_changed_file_blocks_everything(self):
        out = self.t/'b'; bundle(out, {'1_model/a.csv': '1', 'README.md': 'r'})
        (out/'notes.txt').write_text('my notes')
        with self.assertRaises(FileExistsError):
            bh.prepare_output(out, True, self.pkg)
        self.assertTrue((out/'1_model/a.csv').exists() and (out/'notes.txt').exists())
        (out/'notes.txt').unlink(); (out/'README.md').write_text('edited')
        with self.assertRaises(FileExistsError):
            bh.prepare_output(out, True, self.pkg)
        self.assertTrue((out/'1_model/a.csv').exists())

    def test_marker_cannot_point_outside(self):
        out = self.t/'b'; out.mkdir(); victim = self.t/'victim.txt'; victim.write_text('v')
        (out/bh.MARKER).write_text(json.dumps({'files': {'../victim.txt': bh._sha(victim)}}))
        with self.assertRaises(FileExistsError):
            bh.prepare_output(out, True, self.pkg)
        self.assertTrue(victim.exists())

    def test_symlink_to_own_bundle_refused_and_target_kept(self):
        real = self.t/'real'; bundle(real, {'1_model/a.csv': '1', 'README.md': 'r'})
        link = self.t/'link'; link.symlink_to(real, target_is_directory=True)
        for ow in (True, False):
            with self.assertRaises(FileExistsError):
                bh.prepare_output(link, ow, self.pkg)
            with self.assertRaises(FileExistsError):                                 # trailing slash form
                bh.prepare_output(str(link) + '/', ow, self.pkg)
        self.assertTrue(link.is_symlink() and (real/'1_model/a.csv').exists() and (real/bh.MARKER).exists())

    def test_dangling_symlink_refused(self):
        link = self.t/'dangling'; link.symlink_to(self.t/'not_there', target_is_directory=True)
        with self.assertRaises(FileExistsError):
            bh.prepare_output(link, False, self.pkg)
        self.assertFalse((self.t/'not_there').exists())

    def test_own_bundle_is_removed_file_by_file(self):
        out = self.t/'b'; bundle(out, {'1_model/a.csv': '1', '2_detail/x/y.csv': '2', 'README.md': 'r'})
        bh.prepare_output(out, True, self.pkg)
        self.assertFalse(out.exists())


class Roles(unittest.TestCase):
    DICT = pd.DataFrame(dict(scope=['delivery', 'delivery', 'reference'], table=['profiles', 'profiles', 'profiles'],
                             field=['segment', 'age', 'design_probability'], description=['직군', '나이', '설계'], unit=['', '', '']))

    def roles(self, extra_cols):
        cols = ['customer_id', 'dataset', 'cohort', 'segment', 'age'] + extra_cols + bh.LABELS
        t = pd.DataFrame(columns=cols)
        org = {'legacy': {c: 'profiles' for c in cols}, 'thinfile': {}}
        return bh.column_roles({'legacy': t, 'thinfile': pd.DataFrame(columns=['customer_id'])}, self.DICT, org)

    def test_segment_follows_the_dictionary_rule(self):
        r = self.roles([]).set_index('column').role
        self.assertEqual((r['customer_id'], r['cohort'], r['segment'], r['age']), ('id', 'group', 'feature', 'feature'))

    def test_reference_or_unknown_column_stops(self):
        for c in ('design_probability', 'brand_new_column'):
            with self.assertRaises(ValueError):
                self.roles([c])

    def test_segment_not_in_dictionary_stops(self):
        d = self.DICT[self.DICT.field != 'segment']
        t = pd.DataFrame(columns=['customer_id', 'segment'])
        with self.assertRaises(ValueError):
            bh.column_roles({'legacy': t, 'thinfile': pd.DataFrame(columns=['customer_id'])}, d, {'legacy': {'segment': 'profiles', 'customer_id': 'profiles'}, 'thinfile': {}})

    def test_twelve_months_default_six_months_compatibility(self):
        """N-12 두 기간을 보존하되 기본 학습에는 사전 등록된 12개월 열만 선택한다."""
        cols = ['customer_id', 'income_6m_krw', 'income_12m_krw', 'eval_future_credit_exposure']
        tables = {'legacy': pd.DataFrame(columns=cols), 'thinfile': pd.DataFrame(columns=['customer_id'])}
        org = {'legacy': dict(zip(cols, ['profiles', 'input_features_6m', 'input_features_12m', 'target_metadata'])), 'thinfile': {}}
        dictionary = pd.DataFrame(dict(scope=['delivery']*2, table=['input_features_6m', 'input_features_12m'],
                                       field=cols[1:3], description=['보존·참고용 6개월', '기본 12개월'], unit=['원']*2))
        roles = bh.column_roles(tables, dictionary, org).set_index('column').role
        self.assertEqual(roles['income_6m_krw'], 'compatibility_only')
        self.assertEqual(roles['income_12m_krw'], 'feature')
        self.assertEqual(roles['eval_future_credit_exposure'], 'eval_only')
        for field in ['income_6m_krw', 'income_12m_krw']:
            with self.assertRaises(ValueError):
                bh.column_roles(tables, dictionary[dictionary.field != field], org)

    def test_service_view_default_and_split_excluded(self):
        """v3.6.0 서비스 정의 열은 학습, data_split은 학습 제외(split)다."""
        cols = ['customer_id', 'data_split'] + bh.SVC_COLUMNS
        tables = {'legacy': pd.DataFrame(columns=cols), 'thinfile': pd.DataFrame(columns=['customer_id'])}
        org = {'legacy': {c: 'input_features_12m' for c in cols}, 'thinfile': {}}
        org['legacy'].update(customer_id='profiles', data_split='data_split')
        fields = bh.SVC_COLUMNS
        dictionary = pd.DataFrame(dict(scope=['delivery'] * len(fields), table=['input_features_12m'] * len(fields),
                                       field=fields, description=fields, unit=[''] * len(fields)))
        roles = bh.column_roles(tables, dictionary, org).set_index('column').role
        self.assertEqual(roles['data_split'], 'split')
        self.assertEqual(set(roles[bh.SVC_COLUMNS]), {'feature'})
        self.assertEqual(len(bh.MODEL_EXCLUDED_12M_COLUMNS), 10)
        self.assertFalse(set(bh.MODEL_EXCLUDED_12M_COLUMNS) & set(bh.SVC_COLUMNS))

    def test_compatibility_requires_the_expected_source(self):
        """N-12 기존 열 이름만 같다고 출처·사전 검사를 우회하지 못하게 한다."""
        cols = ['customer_id', 'income_6m_krw', bh.LEAK]
        tables = {'legacy': pd.DataFrame(columns=cols), 'thinfile': pd.DataFrame(columns=['customer_id'])}
        dictionary = pd.DataFrame(dict(scope=['reference']*2, table=['input_features_6m']*2,
                                       field=cols[1:], description=['보존용', '미래값'], unit=['원', '회']))
        with self.assertRaises(ValueError):
            bh.column_roles(tables, dictionary, {'legacy': {c: 'input_features_6m' for c in cols}, 'thinfile': {}})

    def test_existing_twelve_month_payment_column_keeps_position_and_value(self):
        """N-12 기존 간편결제 12개월 열을 중복 생성하지 않고 신규 출처와 불일치하면 거부한다."""
        frames = {
            'base_207.csv': pd.DataFrame({'식별구분': ['C1'], bh.LEAK: [0], 'PRE_LMT': [0], 'PRE_RT': [0]}),
            'profiles.csv': pd.DataFrame({'customer_id': ['C1'], 'segment': ['wage'], 'age': [30], bh.LABELS[0]: [0]}),
            'nonfinancial_source_features.csv': pd.DataFrame({'customer_id': ['C1'], 'dp_payment_amount_12m_krw': [100]}),
            'labels_nonfinancial.csv': pd.DataFrame({'customer_id': ['C1'], bh.LABELS[1]: [0]}),
            'input_features_6m.csv': pd.DataFrame({'customer_id': ['C1'], 'income_6m_krw': [600]}),
            'input_features_12m.csv': pd.DataFrame({'customer_id': ['C1'], 'income_12m_krw': [1200], 'dp_payment_amount_12m_krw': [100],
                                                    'income_svc_12m_krw': [1300]}),
            'data_split.csv': pd.DataFrame({'customer_id': ['C1'], 'data_split': ['TEST']}),
        }
        with patch.object(bh, 'read', side_effect=lambda folder, name: frames[name].copy()):
            got = bh.model_table('legacy')
            self.assertEqual(got.columns.tolist(), ['customer_id', 'dataset', 'data_split', 'cohort', 'segment', 'age',
                                                   'dp_payment_amount_12m_krw', 'income_6m_krw', 'income_svc_12m_krw'] + bh.LABELS)
            # v3.6.0: 기존 12개월 열(income_12m_krw 등 10열)은 상세 파일에만 두고 모델 표에서 뺀다.
            self.assertNotIn('income_12m_krw', got.columns)
            self.assertEqual(got.dp_payment_amount_12m_krw.iloc[0], 100)
            # N-12 씬파일도 신규 집계 뒤에 라벨·평가용 tail을 기존 순서대로 둔다.
            frames['profiles.csv'] = frames['profiles.csv'].assign(cohort='no_credit', is_thinfile_scenario=1, label_origin='fixture')
            frames['model_inputs.csv'] = pd.DataFrame({'customer_id': ['C1'], 'credit_usage_available': [0]})
            frames['target_metadata.csv'] = pd.DataFrame({'customer_id': ['C1'], 'future_credit_exposure': [1]})
            thin = bh.model_table('thinfile')
            self.assertEqual(thin.columns.tolist(), ['customer_id', 'dataset', 'data_split', 'cohort', 'segment', 'age',
                                                    'credit_usage_available', 'dp_payment_amount_12m_krw',
                                                    'income_6m_krw', 'income_svc_12m_krw'] + bh.LABELS + ['eval_future_credit_exposure'])
            frames['input_features_12m.csv']['dp_payment_amount_12m_krw'] = 101
            with self.assertRaises(AssertionError):
                bh.model_table('legacy')


if __name__ == '__main__':
    unittest.main()
