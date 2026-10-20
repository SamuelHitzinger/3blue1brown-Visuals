#!/usr/bin/env python3
import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

spec = importlib.util.spec_from_file_location("config", Path(__file__).with_name("container-config.py"))
config = importlib.util.module_from_spec(spec)
spec.loader.exec_module(config)


class EnvironmentTests(unittest.TestCase):
    def test_systemd_backslash_rules_preserve_exact_values(self):
        cases = [
            (r'abc\$HOME\#def', 'abc$HOME#def'),
            (r'"abc\$HOME\`value\"\\\q"', 'abc$HOME`value"\\\\q'),
            (r"'abc\$HOME'", r'abc\$HOME'),
            ('  two  words  ', 'two  words'),
            ('value\\ ', 'value '),
            ('abc"quotes"', 'abc"quotes"'),
            ('"  quoted spaces  "  ', '  quoted spaces  '),
        ]
        for source, expected in cases:
            with self.subTest(source=source):
                self.assertEqual(config.environment_value(source, 'env:1'), expected)

    def test_multiline_and_unclosed_quotes_fail_without_secret_values(self):
        for value in ['secret\\', '"secret', "'secret", '"secret" trailing']:
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, 'env:1$') as error:
                config.environment_value(value, 'env:1')
            self.assertNotIn('secret', str(error.exception))

    def test_precedence_quotes_and_literal_dollars(self):
        with tempfile.TemporaryDirectory() as root:
            old, new = Path(root) / "old.env", Path(root) / "new.env"
            old.write_text('KEY=old\nSPACE="two words"\nLITERAL=abc$HOME#def\n')
            new.write_text("# ignored\n; ignored\nKEY='new'\nEMPTY=\n")
            self.assertEqual(config.read_environment([old, Path(root) / "absent", new]), {
                "KEY": "new", "SPACE": "two words", "LITERAL": "abc$HOME#def", "EMPTY": ""
            })

    def test_root_owned_environment_is_captured_without_logging(self):
        path = Path('/etc/3yellow3white/environment')
        with patch.object(Path, 'read_text', side_effect=PermissionError), patch.object(config.subprocess, 'check_output', return_value='KEY=literal$secret\n') as read:
            self.assertEqual(config.read_environment([path]), {'KEY': 'literal$secret'})
            read.assert_called_once_with(['sudo', '-n', 'cat', '--', str(path)], text=True)

    def test_env_is_never_executed(self):
        with tempfile.TemporaryDirectory() as root:
            env, marker = Path(root) / "test.env", Path(root) / "marker"
            env.write_text(f'KEY=$(touch {marker})\n')
            self.assertEqual(config.read_environment([env])["KEY"], f'$(touch {marker})')
            self.assertFalse(marker.exists())

    def test_malformed_assignment_reports_location_without_value(self):
        with tempfile.TemporaryDirectory() as root:
            env = Path(root) / "test.env"
            env.write_text('BAD-KEY=secret-value\n')
            with self.assertRaisesRegex(ValueError, r'test.env:1$') as error:
                config.read_environment([env])
            self.assertNotIn('secret-value', str(error.exception))

    def test_rejects_paths_that_could_change_compose_interpolation(self):
        for path in ['relative', '/tmp/$HOME', '/tmp/line\nbreak', '/tmp/"quote"']:
            with self.subTest(path=path), self.assertRaises(ValueError):
                config.host_path(path)
        self.assertEqual(config.host_path('/tmp/aha/videos.sqlite'), Path('/tmp/aha/videos.sqlite'))

    def test_agent_state_is_persistent_and_separate_from_releases(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            release = base / 'releases' / 'candidate'
            release.mkdir(parents=True)
            values = {'NARRATION_DATA_DIR': str(base / 'narration')}
            with patch.object(config, 'read_environment', return_value=values), patch.object(config.sys, 'argv', ['config', str(release), str(base), 'a' * 40, 'image']):
                config.main()
                paths = json.loads((release / 'paths.json').read_text())
                self.assertEqual(paths['agents'], str(base / 'agents'))
                self.assertIn(f'AHA_AGENT_DATA_DIR={base}/agents\n', (release / 'compose.env').read_text())
                for path in [base / 'data', base / 'narration' / 'pi', release / 'pi', base / 'releases']:
                    with self.subTest(path=path), self.assertRaises(ValueError):
                        values['AGENT_STATE_DIR'] = str(path)
                        config.main()

    def test_deployment_settings_override_host_values_without_losing_storage(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            release = base / 'releases' / 'candidate'
            release.mkdir(parents=True)
            override = base / 'deployment.env'
            override.write_text('ELEVENLABS_API_KEY="literal$secret\\\\value\\\"quote"\nELEVENLABS_VOICE_ID=alice\n')
            host = {'ELEVENLABS_API_KEY': 'old-key', 'AGENT_MODEL': 'existing-model',
                    'VIDEO_DB_PATH': str(base / 'videos' / 'jobs.sqlite'),
                    'NARRATION_DATA_DIR': str(base / 'narration')}
            original_read = config.read_environment
            def read(paths):
                return host if paths[0] == Path('/srv/apps/3yellow3white/.env') else original_read(paths)
            argv = ['config', str(release), str(base), 'a' * 40, 'image', str(override)]
            with patch.object(config, 'read_environment', side_effect=read), patch.object(config.sys, 'argv', argv):
                config.main()
            # Compose reads the generated runtime file with format: raw.
            runtime = (release / 'runtime.env').read_text()
            self.assertIn('ELEVENLABS_API_KEY=literal$secret\\value"quote\n', runtime)
            self.assertIn('ELEVENLABS_VOICE_ID=alice\n', runtime)
            self.assertIn('AGENT_MODEL=existing-model\n', runtime)
            self.assertEqual(json.loads((release / 'paths.json').read_text())['video'], str(base / 'videos'))
            self.assertEqual((release / 'runtime.env').stat().st_mode & 0o777, 0o600)

    def test_workflow_serializes_private_narration_settings_and_rejects_invalid_secrets(self):
        command = [config.sys.executable, str(Path(__file__).with_name('prepare-deployment.py')), 'env']
        with tempfile.TemporaryDirectory() as root:
            (Path(root) / 'aha-ssh').mkdir(mode=0o700)
            values = {'ELEVENLABS_API_KEY': 'literal$secret\\value"quote', 'ELEVENLABS_VOICE_ID': 'alice',
                      'ELEVENLABS_MODEL_ID': 'eleven_multilingual_v2', 'NARRATION_PUBLIC_ORIGIN': 'https://example.test'}
            env = dict(os.environ, **values, RUNNER_TEMP=root)
            result = subprocess.run(command, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout, '')
            path = Path(root) / 'aha-ssh/deployment.env'
            self.assertEqual(config.read_environment([path]), values)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            for invalid in ['', 'secret\nINJECTED=value']:
                env['ELEVENLABS_API_KEY'] = invalid
                result = subprocess.run(command, env=env, capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('ELEVENLABS_API_KEY', result.stderr)
                self.assertNotIn('INJECTED', result.stderr)


    def test_ssh_files_are_private_and_host_checked(self):
        with tempfile.TemporaryDirectory() as root:
            env = dict(os.environ, RUNNER_TEMP=root, VM_HOST='example.test', VM_SSH_USER='deploy',
                       VM_SSH_PRIVATE_KEY='private-key', VM_SSH_KNOWN_HOSTS='example.test ssh-ed25519 fixture')
            command = [config.sys.executable, str(Path(__file__).with_name('prepare-deployment.py')), 'ssh']
            result = subprocess.run(command, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout, '')
            directory = Path(root) / 'aha-ssh'
            self.assertEqual(directory.stat().st_mode & 0o777, 0o700)
            for name in ('key', 'known_hosts', 'config'):
                self.assertEqual((directory / name).stat().st_mode & 0o777, 0o600)
            self.assertEqual((directory / 'key').read_text(), 'private-key\n')
            self.assertIn('StrictHostKeyChecking yes', (directory / 'config').read_text())

    def test_ssh_rejects_missing_settings_and_injection(self):
        for name, value in [('VM_SSH_PRIVATE_KEY', ''), ('VM_SSH_KNOWN_HOSTS', ''),
                            ('VM_HOST', 'example.test\nProxyCommand unsafe'), ('VM_SSH_USER', '-option')]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as root:
                env = dict(os.environ, RUNNER_TEMP=root, VM_HOST='example.test', VM_SSH_USER='deploy',
                           VM_SSH_PRIVATE_KEY='private-value', VM_SSH_KNOWN_HOSTS='fixture')
                env[name] = value
                result = subprocess.run([config.sys.executable, str(Path(__file__).with_name('prepare-deployment.py')), 'ssh'],
                                        env=env, capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(name, result.stderr)
                self.assertNotIn('private-value', result.stderr)
                self.assertFalse((Path(root) / 'aha-ssh').exists())


if __name__ == '__main__':
    unittest.main()
