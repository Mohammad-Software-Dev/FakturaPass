import importlib.util
import io
import tarfile
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

    def test_configuration_rejects_changed_missing_extra_and_linked_files(self):
        def installed(files, link=False):
            out = io.BytesIO()
            with tarfile.open(fileobj=out, mode='w') as t:
                for name, data in files.items():
                    item = tarfile.TarInfo('./' + name)
                    if link:
                        item.type = tarfile.SYMTYPE
                        item.linkname = '/outside'
                        t.addfile(item)
                    else:
                        item.size = len(data)
                        t.addfile(item, io.BytesIO(data))
            return out.getvalue()
        files = {'a.xsd': b'copyright original', 'b.xsl': b'rules'}
        expected = archive(files)
        result = evidence.compare_configuration(expected, installed(files))
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['noticeLines'], [1])
        self.assertEqual(result[1]['review'], 'NO_NOTICE_DETECTED_REVIEW_REQUIRED')
        for changed in [{}, {'a.xsd': b'changed', 'b.xsl': b'rules'},
                        dict(files, extra=b'unexpected')]:
            with self.assertRaises(ValueError):
                evidence.compare_configuration(expected, installed(changed))
        with self.assertRaises(ValueError):
            evidence.compare_configuration(expected, installed(files, link=True))

    def test_archive_paths_and_duplicates_are_rejected(self):
        for name in ['../outside', '/absolute', 'a/../b', 'a//b']:
            with self.assertRaises(ValueError):
                evidence.zip_files(archive({name: b'bad'}))
        out = io.BytesIO()
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', UserWarning)
            with zipfile.ZipFile(out, 'w') as z:
                z.writestr('same', 'one')
                z.writestr('same', 'two')
        with self.assertRaises(ValueError):
            evidence.zip_files(out.getvalue())


if __name__ == '__main__':
    unittest.main()
