#!/usr/bin/env python3
"""Safety tests for destructive image retention, with no Docker dependency."""
import fcntl
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import json

spec = importlib.util.spec_from_file_location('retention', Path(__file__).with_name('cleanup-images.py'))
retention = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retention)


def image(number, tags=None):
    return {'Id': 'sha256:' + f'{number:064x}',
            'RepoTags': tags if tags is not None else ['3yellow3white:' + f'{number:040x}']}


class RetentionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        (self.base / 'releases').mkdir()
        self.releases = []
        for i in range(1, 5):
            release = self.base / 'releases' / str(i)
            release.mkdir()
            (release / 'compose.env').write_text('AHA_IMAGE=' + image(i)['Id'] + '\n')
            self.releases.append(release)
        (self.base / 'docker-current').symlink_to(self.releases[0])
        for previous, following in zip(self.releases, self.releases[1:]):
            (previous / 'previous-docker').symlink_to(following)

    def test_keeps_current_and_two_rollback_releases(self):
        self.assertEqual(retention.retained_images(self.base), {image(i)['Id'] for i in (1, 2, 3)})

    def test_first_release_without_rollback(self):
        (self.releases[0] / 'previous-docker').unlink()
        self.assertEqual(retention.retained_images(self.base), {image(1)['Id']})

    def test_broken_rollback_fails_closed(self):
        (self.releases[1] / 'compose.env').unlink()
        with self.assertRaises(OSError):
            retention.retained_images(self.base)

    def test_external_rollback_fails_closed(self):
        link = self.releases[0] / 'previous-docker'
        link.unlink()
        link.symlink_to(self.base)
        with self.assertRaises(ValueError):
            retention.retained_images(self.base)

    def test_cycle_fails_closed(self):
        link = self.releases[0] / 'previous-docker'
        link.unlink()
        link.symlink_to(self.releases[0])
        with self.assertRaises(ValueError):
            retention.retained_images(self.base)

    def test_malformed_or_duplicate_image_reference_fails_closed(self):
        for value in ['AHA_IMAGE=$(command)\n', 'AHA_IMAGE=' + image(1)['Id'] + '\nAHA_IMAGE=' + image(2)['Id']]:
            (self.releases[0] / 'compose.env').write_text(value)
            with self.assertRaises(ValueError):
                retention.retained_images(self.base)

    def fake_docker(self, *args):
        if args == ('ps', '-aq'):
            return 'stopped-container'
        if args == ('inspect', 'stopped-container'):
            return json.dumps([{'Image': image(4)['Id']}])
        if args == ('image', 'ls', '-q', '--no-trunc'):
            return '\n'.join(item['Id'] for item in self.images)
        if args[:2] == ('image', 'inspect'):
            return json.dumps(self.images)
        self.fail(f'Unexpected Docker operation: {args}')

    def run_cleanup(self, apply):
        self.images = [image(i) for i in range(1, 8)] + [
            image(8, ['unrelated:latest']),
            image(9, ['3yellow3white:' + '9' * 40, 'other-project:latest']),
            image(10, []), image(11, ['3yellow3white:manual-keep']),
        ]
        with patch.object(retention, 'docker', self.fake_docker), patch.object(retention.subprocess, 'run') as remove:
            retention.cleanup(self.base, apply, image(7)['RepoTags'])
            return remove.call_args_list

    def test_removes_only_obsolete_app_images_without_force(self):
        calls = self.run_cleanup(True)
        self.assertEqual([call.args[0] for call in calls], [
            ['sudo', '-n', 'docker', 'image', 'rm', image(i)['Id']] for i in (5, 6)])

    def test_dry_run_never_deletes(self):
        self.assertEqual(self.run_cleanup(False), [])

    def test_missing_retained_image_aborts_before_deletion(self):
        self.images = [image(1), image(3), image(4), image(5)]
        with patch.object(retention, 'docker', self.fake_docker), patch.object(retention.subprocess, 'run') as remove:
            with self.assertRaises(ValueError):
                retention.cleanup(self.base, True, [])
            remove.assert_not_called()

    def test_low_disk_space_rejects_load(self):
        usage = type('Usage', (), {'free': 7 * retention.GIB})()
        with patch.object(retention.shutil, 'disk_usage', return_value=usage):
            with self.assertRaisesRegex(ValueError, 'Insufficient disk space'):
                retention.check_space([self.base], 8 * retention.GIB)

    def test_running_deployment_skips_all_docker_operations(self):
        with (self.base / 'deploy.lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            result = subprocess.run([sys.executable, str(Path(retention.__file__)), '--base', str(self.base), '--apply'],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('Deployment in progress; skipping', result.stdout)

    def test_first_migration_does_not_delete_existing_images(self):
        (self.base / 'docker-current').unlink()
        with patch.object(sys, 'argv', ['cleanup', '--base', str(self.base), '--apply']), patch.object(retention, 'docker') as docker:
            retention.main()
            docker.assert_not_called()

    def test_inherited_lock_is_verified_and_reused(self):
        with (self.base / 'deploy.lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            with patch.object(sys, 'argv', ['cleanup', '--base', str(self.base), '--lock-fd', str(lock.fileno())]), patch.object(retention, 'cleanup') as cleanup:
                retention.main()
                cleanup.assert_called_once()
        with (self.base / 'wrong-lock').open('w') as lock:
            with patch.object(sys, 'argv', ['cleanup', '--base', str(self.base), '--lock-fd', str(lock.fileno())]), patch.object(retention, 'cleanup') as cleanup:
                with self.assertRaises(ValueError):
                    retention.main()
                cleanup.assert_not_called()


if __name__ == '__main__':
    unittest.main()
