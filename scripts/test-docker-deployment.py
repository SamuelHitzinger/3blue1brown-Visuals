#!/usr/bin/env python3
"""Exercise activation/rollback on the VM with isolated storage, port, unit and project.

Run as deploy: python3 scripts/test-docker-deployment.py ARCHIVE SHA LEGACY_RELEASE
Requires passwordless sudo, systemd, Docker, and an existing legacy Bun release.
Production is only read to obtain the legacy release path; it is never stopped.
"""
import fcntl
import json
import os
import socket
import subprocess
import sys
import tarfile
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen


def run(*args, **kwargs):
    return subprocess.run(args, check=True, text=True, **kwargs)


def main():
    archive, revision, legacy = sys.argv[1:]
    assert os.getuid() != 0 and run('id', '-un', capture_output=True).stdout.strip() == 'deploy'
    legacy = Path(legacy).resolve()
    assert (legacy / 'bin/bun').is_file() and (legacy / 'backend/src/index.ts').is_file()
    with tempfile.TemporaryDirectory(prefix='aha-deploy-test-', dir='/tmp') as root:
        root = Path(root)
        base, payload = root / 'sandbox', root / 'payload'
        base.mkdir(); payload.mkdir()
        (base / 'data').mkdir(); (base / 'narration').mkdir()
        project = root.name
        unit = Path('/etc/systemd/system') / (project + '.service')
        assert not unit.exists()
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        with tarfile.open(archive) as bundle:
            bundle.extractall(payload, filter='data')
        config = payload / 'scripts/container-config.py'
        text = config.read_text().replace('read_environment([Path("/srv/apps/3yellow3white/.env"), Path("/etc/3yellow3white/environment")])', 'read_environment([])')
        text = text.replace('"/var/lib/3yellow3white/narration"', repr(str(base / 'narration')))
        text = text.replace('"AHA_BIND_ADDRESS": "0.0.0.0"', '"AHA_BIND_ADDRESS": "127.0.0.1"')
        text = text.replace('"AHA_PORT": "8080"', f'"AHA_PORT": "{port}"')
        config.write_text(text)
        sandbox_archive = root / 'release.tar.gz'
        with tarfile.open(sandbox_archive, 'w:gz') as bundle:
            for path in payload.iterdir():
                bundle.add(path, arcname=path.name)
        source = Path(__file__).with_name('deploy-release.sh').read_text()
        replacements = {
            'base=/srv/apps/3yellow3white-actions': f'base={base}',
            'service=3yellow3white': f'service={project}',
            'project=3yellow3white': f'project={project}',
            'health_url=http://127.0.0.1:8080/healthz': f'health_url=http://127.0.0.1:{port}/healthz',
        }
        for old, new in replacements.items():
            assert source.count(old) == 1, old
            source = source.replace(old, new)
        source = source.replace('--wait-timeout 60', '--wait-timeout 15')
        # The test shares the VM's Docker daemon. Retention is tested separately;
        # sandbox activation must never delete production's rollback images.
        source = source.replace('retention_args+=(--apply)', ':')
        source = source.replace('--lock-fd 9 --apply', '--lock-fd 9')
        healthy, failing, blocked = root / 'healthy.sh', root / 'failing.sh', root / 'blocked.sh'
        healthy.write_text(source)
        trigger = 'compose "$release" up --detach --wait --wait-timeout 15\n'
        assert source.count(trigger) == 1
        # Inject a crash only after the unchanged candidate test has passed.
        injection = '''python3 - "$release/compose.yaml" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
p.write_text(p.read_text().replace('  app:\\n', '  app:\\n    command: ["-e", "process.exit(17)"]\\n'))
PY
'''
        failing.write_text(source.replace(trigger, injection + trigger))
        # Simulate Docker refusing to remove the failed candidate during rollback.
        removal = 'if ! compose "$release" down --timeout 30; then'
        assert failing.read_text().count(removal) == 1
        blocked.write_text(failing.read_text().replace(removal, 'if ! false; then'))
        unit_text = root / 'legacy.service'
        unit_text.write_text(f'''[Unit]
Description=Isolated Docker migration test (temporary)
[Service]
User=deploy
Group=deploy
WorkingDirectory={legacy}
Environment=NODE_ENV=production HOST=127.0.0.1 PORT={port}
Environment=APP_REVISION={revision}
Environment=VIDEO_DB_PATH={base}/data/videos.sqlite
Environment=NARRATION_DATA_DIR={base}/narration
ExecStart={legacy}/bin/bun backend/src/index.ts
[Install]
WantedBy=multi-user.target
''')
        try:
            run('sudo', '-n', 'install', '-m', '644', str(unit_text), str(unit))
            run('sudo', '-n', 'systemctl', 'daemon-reload')
            run('sudo', '-n', 'systemctl', 'enable', '--now', project)
            for attempt in range(30):
                try:
                    with urlopen(f'http://127.0.0.1:{port}/healthz', timeout=2) as response:
                        assert json.load(response)['revision'] == revision
                    break
                except OSError:
                    time.sleep(0.2)
            else:
                raise AssertionError('Isolated legacy service did not start')
            # An unremoved candidate must never be given a competing writer.
            result = subprocess.run(['bash', str(blocked), str(sandbox_archive), revision], capture_output=True, text=True)
            assert result.returncode != 0 and 'ROLLBACK FAILED' in result.stderr, result.stderr
            assert subprocess.run(['systemctl', 'is-active', '--quiet', project]).returncode != 0
            assert subprocess.run(['systemctl', 'is-enabled', project], capture_output=True, text=True).stdout.strip() == 'disabled'
            retained = list((base / 'releases').iterdir())
            assert len(retained) == 1, 'Recovery files were not retained'
            run('sudo', '-n', 'docker', 'compose', '--project-name', project,
                '--env-file', str(retained[0] / 'compose.env'), '--file', str(retained[0] / 'compose.yaml'), 'down')
            run('sudo', '-n', 'systemctl', 'enable', '--now', project)
            print('Blocked candidate removal retained recovery files and prevented a competing writer.', flush=True)
            # Failed first migration must restore the running/enabled legacy unit.
            result = subprocess.run(['bash', str(failing), str(sandbox_archive), revision], capture_output=True, text=True)
            print(result.stdout, result.stderr, flush=True)
            assert 'New container failed; restoring the previous deployment.' in result.stdout + result.stderr, 'Failure occurred before activation'
            assert result.returncode != 0, 'Injected crash was accepted'
            run('systemctl', 'is-active', '--quiet', project)
            assert run('systemctl', 'is-enabled', project, capture_output=True).stdout.strip() == 'enabled'
            assert not (base / 'docker-current').exists()
            print('Failed first migration restored the isolated systemd service.', flush=True)
            run('bash', str(healthy), str(sandbox_archive), revision)
            previous = (base / 'docker-current').resolve()
            assert subprocess.run(['systemctl', 'is-active', '--quiet', project]).returncode != 0
            assert subprocess.run(['systemctl', 'is-enabled', project], capture_output=True, text=True).stdout.strip() == 'disabled'
            print('Successful migration started Docker and disabled the isolated legacy unit.', flush=True)
            result = subprocess.run(['bash', str(failing), str(sandbox_archive), revision], capture_output=True, text=True)
            print(result.stdout, result.stderr, flush=True)
            assert 'New container failed; restoring the previous deployment.' in result.stdout + result.stderr, 'Failure occurred before activation'
            assert result.returncode != 0, 'Injected failed upgrade was accepted'
            assert (base / 'docker-current').resolve() == previous
            with urlopen(f'http://127.0.0.1:{port}/healthz', timeout=5) as response:
                assert json.load(response) == {'ok': True, 'revision': revision}
            print('Failed upgrade restored the previous healthy Docker release.', flush=True)
        finally:
            # All names/paths here were allocated by this test, never production.
            subprocess.run(['sudo', '-n', 'systemctl', 'disable', '--now', project])
            containers = run('sudo', '-n', 'docker', 'ps', '-aq', '--filter', f'label=com.docker.compose.project={project}', capture_output=True).stdout.split()
            if containers:
                run('sudo', '-n', 'docker', 'rm', '-f', *containers)
            networks = run('sudo', '-n', 'docker', 'network', 'ls', '-q', '--filter', f'label=com.docker.compose.project={project}', capture_output=True).stdout.split()
            if networks:
                run('sudo', '-n', 'docker', 'network', 'rm', *networks)
            run('sudo', '-n', 'rm', '-f', str(unit))
            run('sudo', '-n', 'systemctl', 'daemon-reload')
            subprocess.run(['sudo', '-n', 'systemctl', 'reset-failed', project], stderr=subprocess.DEVNULL)


if __name__ == '__main__':
    # Image loading in this sandbox shares Docker with the real deployment and
    # hourly retention. Hold its lock for the whole test, including smoke jobs.
    with Path('/srv/apps/3yellow3white-actions/deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        main()
