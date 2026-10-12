"""Collect pinned upstream sources and original notices; does not approve licensing."""
import hashlib
import io
import json
import re
import subprocess
import sys
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def sha(data):
    return hashlib.sha256(data).hexdigest()


def checked(data, expected):
    if not re.fullmatch(r"[a-f0-9]{64}", expected) or sha(data) != expected:
        raise ValueError("Evidence checksum mismatch")
    return data


def command(*args):
    return subprocess.check_output(args, cwd=ROOT, timeout=180)


def source_coverage(jar, records):
    with zipfile.ZipFile(io.BytesIO(jar)) as z:
        classes = [n for n in z.namelist() if n.endswith('.class')]
    expected = {n.split('$')[0] + '.java' if '$' in n else n[:-6] + '.java'
                for n in classes}
    if not expected:
        raise ValueError('Empty class inventory')
    paths = [r['path'] for r in records]
    if len(paths) != len(set(paths)):
        raise ValueError('Duplicate source path')
    for path in expected:
        if sum(p.endswith('/' + path) for p in paths) != 1:
            raise ValueError('Missing or ambiguous class source: ' + path)
    if len(paths) != len(expected):
        raise ValueError('Unexpected source records')
    return {'classes': len(classes), 'sourceFiles': len(expected)}


def compare_saxon(installed, upstream):
    with zipfile.ZipFile(io.BytesIO(installed)) as a, zipfile.ZipFile(io.BytesIO(upstream)) as b:
        if set(a.namelist()) != set(b.namelist()):
            raise ValueError('Saxon archive members differ')
        differences = sorted(n for n in a.namelist() if a.read(n) != b.read(n))
        if set(differences) - {'META-INF/MANIFEST.MF', 'META-INF/SAXON.RSA', 'META-INF/SAXON.SF'}:
            raise ValueError('Saxon payload differs')
        count = sum(n.endswith('.class') for n in a.namelist())
        if count == 0:
            raise ValueError('Empty Saxon class inventory')
        return {'identicalClasses': count, 'differingMembers': differences,
                'installedJarSha256': sha(installed), 'upstreamJarSha256': sha(upstream)}


def collect(image):
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', image):
        raise ValueError('An immutable Docker image ID is required')
    lock_bytes = (ROOT / 'services/invoice-engine/metadata/sources.lock.json').read_bytes()
    lock = json.loads(lock_bytes)
    if lock['schemaVersion'] != 'fakturapass.validator-sources.v1':
        raise ValueError('Unsupported source evidence lock')
    out = ROOT / '.data/releases' / f'validator-sources-{int(time.time() * 1000)}'
    out.mkdir(parents=True, mode=0o700)
    hashes = {}

    def save(name, data):
        if not re.fullmatch(r'[A-Za-z0-9_.-]+', name):
            raise ValueError('Unsafe evidence filename')
        if name in hashes:
            raise ValueError('Duplicate evidence filename')
        (out / name).write_bytes(data)
        hashes[name] = sha(data)

    def image_file(path):
        return command('docker', 'run', '--rm', '--read-only', '--network', 'none',
                       '--entrypoint', 'cat', image, path)

    def download(record):
        # Only pinned upstream HTTPS resources; redirects remain HTTPS.
        if not re.fullmatch(r'https://raw\.githubusercontent\.com/(adoptium/jdk25u|Saxonica/Saxon-HE)/[a-f0-9]{40}/[A-Za-z0-9_./-]+', record['url']):
            raise ValueError('Unpinned source URL')
        return checked(command('curl', '--proto', '=https', '--proto-redir', '=https',
                               '-fLsS', '--max-time', '120', record['url']), record['sha256'])

    save('sources.lock.json', lock_bytes)
    release = image_file('/opt/java/openjdk/release')
    save('jre-release.txt', release)
    values = dict(re.findall(r'^(\w+)="([^"\n]*)"$', release.decode(), re.M))
    jre = lock['jre']
    if (values.get('JAVA_VERSION') != jre['version'] or
        values.get('SOURCE') != '.:git:' + jre['commit'][:12] or
        values.get('SOURCE_REPO') != 'https://github.com/adoptium/jdk25u.git'):
        raise ValueError('JRE source identity differs from lock')
    jar = checked(image_file('/opt/java/openjdk/lib/jrt-fs.jar'), jre['jarSha256'])
    save('jrt-fs.jar', jar)
    coverage = source_coverage(jar, jre['sources'])
    for record in jre['sources']:
        if record['url'] != f"https://raw.githubusercontent.com/adoptium/jdk25u/{jre['commit']}/{record['path']}":
            raise ValueError('JRE source commit/path mismatch')
        data = download(record)
        header = data.split(b'*/', 1)[0]
        if b'GNU General Public License version 2 only' not in header or b'"Classpath" exception' not in header:
            raise ValueError('Unexpected source license header')
        save(Path(record['path']).name, data)
    for name in ['LICENSE', 'ADDITIONAL_LICENSE_INFO', 'ASSEMBLY_EXCEPTION']:
        save('jre-' + name + '.txt', image_file('/opt/java/openjdk/legal/java.base/' + name))
    saxon = lock['saxon']
    installed = checked(image_file(f"/engine/distribution/libs/Saxon-HE-{saxon['version']}.jar"), saxon['jarSha256'])
    archives = {}
    for record in saxon['archives']:
        data = download(record)
        save(record['file'], data)
        archives[record['file']] = data
    with zipfile.ZipFile(io.BytesIO(archives['SaxonHE12-9J.zip'])) as z:
        comparison = compare_saxon(installed, z.read('saxon-he-12.9.jar'))
        for name in z.namelist():
            if name.startswith('notices/') and not name.endswith('/'):
                save('saxon-' + Path(name).name, z.read(name))
    report = {'schemaVersion': 'fakturapass.validator-source-evidence.v1',
              'imageId': image, 'sourceRevision': command('git', 'rev-parse', 'HEAD').decode().strip(),
              'workingTreeDirty': bool(command('git', 'status', '--porcelain').strip()),
              'jre': coverage, 'saxon': comparison, 'files': hashes,
              'scope': 'Source/header and notice evidence only; not a reproducible-build claim, license approval or release manifest. Saxon source ZIP is preprocessed; preferred-form source review remains separate.'}
    (out / 'source-evidence.json').write_text(json.dumps(report, indent=2) + '\n')
    print(out)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python3 scripts/validator-source-evidence.py sha256:<immutable-image-id>')
    collect(sys.argv[1])
