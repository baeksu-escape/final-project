"""Fixed-fixture checks for tools/build_handoff.py: output-folder safety and strict column roles.
Uses temporary folders only; no generator is run and no project data is read."""
import json
import tempfile
import unittest
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


if __name__ == '__main__':
    unittest.main()
