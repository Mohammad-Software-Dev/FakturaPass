import importlib.util
import io
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    'evidence', Path(__file__).resolve().parent.parent / 'scripts/validator-source-evidence.py')
evidence = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evidence)


def archive(files):
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w') as z:
        for name, content in files.items():
            z.writestr(name, content)
    return out.getvalue()


class EvidenceTests(unittest.TestCase):
    def test_hash_rejects_tampering(self):
        self.assertEqual(evidence.checked(b'ok', evidence.sha(b'ok')), b'ok')
        for digest in ['bad', evidence.sha(b'other')]:
            with self.assertRaises(ValueError):
                evidence.checked(b'ok', digest)

    def test_class_coverage_is_exact(self):
        jar = archive({'jdk/Foo.class': b'a', 'jdk/Foo$Inner.class': b'b'})
        records = [{'path': 'src/java.base/share/classes/jdk/Foo.java'}]
        self.assertEqual(evidence.source_coverage(jar, records), {'classes': 2, 'sourceFiles': 1})
        for invalid in [[], records * 2, records + [{'path': 'other/jdk/Foo.java'}],
                        records + [{'path': 'other/Bar.java'}]]:
            with self.assertRaises(ValueError):
                evidence.source_coverage(jar, invalid)

    def test_saxon_allows_only_signature_differences(self):
        files = {'net/Foo.class': b'code', 'resource.xml': b'data', 'META-INF/MANIFEST.MF': b'old'}
        original = archive(files)
        changed = dict(files, **{'META-INF/MANIFEST.MF': b'new'})
        result = evidence.compare_saxon(original, archive(changed))
        self.assertEqual(result['identicalClasses'], 1)
        self.assertEqual(result['differingMembers'], ['META-INF/MANIFEST.MF'])
        for key in ['net/Foo.class', 'resource.xml', 'new.class']:
            with self.assertRaises(ValueError):
                evidence.compare_saxon(original, archive(dict(files, **{key: b'changed'})))
        with self.assertRaises(ValueError):
            evidence.compare_saxon(archive({'resource': b'a'}), archive({'resource': b'a'}))


if __name__ == '__main__':
    unittest.main()
