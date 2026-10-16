"""Standard-library protocol tests; never import model packages or read audio."""
import base64
import importlib.util
import io
import json
import os
from pathlib import Path
from types import SimpleNamespace
import tempfile
import threading
import unittest
import subprocess
import sys
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('local_asr', Path(__file__).with_name('local-asr.py'))
asr = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(asr)


def chunk(identifier='one', start=100, duration=1):
    return {'type': 'chunk', 'id': identifier, 'sourceId': 'public-lecture',
            'sourceStartSec': start, 'sourceEndSec': start + duration,
            'pcm16Base64': base64.b64encode(b'\0\0' * round(16000 * duration)).decode()}


class StreamTests(unittest.TestCase):
    def execute(self, messages, *, recognize_override=None, clock_override=None, **limits):
        temporary_root = asr.REPO / '.tmp/realtime-media/stream-tests'
        temporary_root.mkdir(parents=True, exist_ok=True)
        self.folder = tempfile.TemporaryDirectory(dir=temporary_root)
        assert Path(self.folder.name).resolve().is_relative_to(temporary_root.resolve())
        self.addCleanup(self.folder.cleanup)
        self.output = Path(self.folder.name)
        self.events, self.calls = [], []
        tick = iter(range(0, 100000, 10))

        def recognize(pcm):
            self.calls.append(pcm)
            word = SimpleNamespace(word=' hello', start=.2, end=.8, probability=.9)
            segment = SimpleNamespace(start=.2, end=.8, text=' hello', words=[word])
            return iter([segment]), SimpleNamespace(language='en', language_probability=1)

        encoded = b''.join((json.dumps(message) + '\n').encode() for message in messages)
        return asr.process_stream(io.BytesIO(encoded), self.events.append, self.output,
                                  recognize_override or recognize, {'clockDomain': 'test-clock', 'importMs': 0, 'modelLoadMs': 0},
                                  clock=clock_override or (lambda: next(tick)), **limits)

    def test_two_chunks_reuse_recognizer_and_keep_measured_words(self):
        result = self.execute([chunk(), chunk('two', 101), {'type': 'shutdown'}])
        self.assertEqual(result['status'], 'complete')
        self.assertEqual(result['chunks'], 2)
        self.assertEqual(len(self.calls), 2)
        self.assertEqual([event['type'] for event in self.events],
                         ['ready', 'inference-start', 'trial', 'inference-start', 'trial', 'complete'])
        trials = [event for event in self.events if event['type'] == 'trial']
        first = trials[0]
        self.assertEqual(first['trial']['segments'][0]['words'][0]['sourceStartSec'], 100.2)
        self.assertEqual(first['trial']['text'], 'hello')
        self.assertEqual(first['trial']['windowEndSec'], 1)
        self.assertEqual(first['trial']['availableAfterSourceSec'], 101)
        receipt = first['receipt']
        self.assertEqual(receipt['clockDomain'], 'test-clock')
        self.assertLessEqual(receipt['receivedAtMs'], receipt['inferenceStartedAtMs'])
        self.assertLess(receipt['inferenceStartedAtMs'], receipt['inferenceCompletedAtMs'])
        self.assertEqual(first['trial']['inferenceMs'], receipt['inferenceCompletedAtMs'] - receipt['inferenceStartedAtMs'])
        self.assertEqual((self.output / 'chunk-0000' / 'audio.pcm').stat().st_size, 32000)
        self.assertEqual(json.loads((self.output / 'chunk-0000' / 'trial.json').read_text())['text'], 'hello')
        self.assertNotIn('pcm16Base64', (self.output / 'chunk-0000' / 'input.json').read_text())

    def test_duplicate_rejected_without_second_inference(self):
        result = self.execute([chunk(), chunk()])
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['error']['code'], 'duplicate-id')
        self.assertEqual(len(self.calls), 1)

    def test_invalid_inputs_rejected_before_inference(self):
        invalid = []
        for field, value in [('id', '../escape'), ('sourceId', ''), ('sourceStartSec', True),
                             ('sourceStartSec', float('nan')), ('sourceEndSec', 100),
                             ('sourceEndSec', 109), ('pcm16Base64', '!!!!'),
                             ('pcm16Base64', base64.b64encode(b'odd').decode())]:
            value_chunk = chunk(); value_chunk[field] = value; invalid.append(value_chunk)
        invalid.append({**chunk(), 'audioPath': '/private.wav'})
        for message in invalid:
            with self.subTest(message={k: v for k, v in message.items() if k != 'pcm16Base64'}):
                result = self.execute([message])
                self.assertEqual(result['status'], 'failed')
                self.assertEqual(self.calls, [])

    def test_total_audio_and_chunk_count_limits(self):
        result = self.execute([chunk(), chunk('two', 101)], max_chunks=1)
        self.assertEqual(result['error']['code'], 'chunk-budget')
        self.assertEqual(len(self.calls), 1)
        result = self.execute([chunk(), chunk('two', 101)], max_audio_seconds=1)
        self.assertEqual(result['error']['code'], 'audio-budget')
        self.assertEqual(len(self.calls), 1)

    def test_eof_and_explicit_shutdown_ignore_later_payload(self):
        self.assertEqual(self.execute([])['reason'], 'eof')
        result = self.execute([{'type': 'shutdown'}, chunk()])
        self.assertEqual(result['reason'], 'shutdown')
        self.assertEqual(self.calls, [])

    def test_overlap_is_allowed_with_new_identity(self):
        self.assertEqual(self.execute([chunk(), chunk('overlap', 100.5)])['chunks'], 2)

    def test_bounded_reader_rejects_oversized_or_unterminated_line(self):
        for payload in [b'x' * (asr.MAX_LINE_BYTES + 1), b'{"type":"shutdown"}']:
            reader = asr.BoundedLines(io.BytesIO(payload))
            with self.assertRaises(asr.StreamProtocolError):
                reader.get(1)
            reader.close()

    def test_reader_idle_timeout_can_close_without_waiting_for_input(self):
        gate = threading.Event()

        class BlockingInput:
            def read(self, _size):
                gate.wait()
                return b''

        reader = asr.BoundedLines(BlockingInput())
        try:
            with self.assertRaisesRegex(asr.StreamProtocolError, 'input-timeout'):
                reader.get(.01)
        finally:
            reader.close()
            gate.set()

    def test_model_failure_keeps_input_and_failure_without_fake_trial(self):
        def failed(_pcm):
            raise RuntimeError('secret transcript must not become error output')
        result = self.execute([chunk()], recognize_override=failed)
        self.assertEqual(result['error']['code'], 'stream-failed')
        self.assertEqual(result['chunks'], 0)
        self.assertTrue((self.output / 'chunk-0000/audio.pcm').exists())
        self.assertTrue((self.output / 'chunk-0000/failure.json').exists())
        self.assertFalse((self.output / 'chunk-0000/trial.json').exists())
        self.assertNotIn('secret transcript', json.dumps(self.events))

    def test_strict_json_rejects_duplicate_keys(self):
        with self.assertRaisesRegex(asr.StreamProtocolError, 'duplicate-json-key'):
            asr.strict_json(b'{"type":"shutdown","type":"chunk"}\n')

    def test_immutable_artifacts_reject_overwrite(self):
        self.execute([chunk()])
        original = (self.output / 'chunk-0000/trial.json').read_bytes()
        with self.assertRaises(FileExistsError):
            asr.save(self.output / 'chunk-0000/trial.json', {'changed': True})
        self.assertEqual((self.output / 'chunk-0000/trial.json').read_bytes(), original)

    def test_session_limit_is_not_reset_per_chunk(self):
        now = [0]

        def slow(_pcm):
            now[0] = 2000
            return iter([]), SimpleNamespace(language='en', language_probability=1)

        result = self.execute([chunk(), chunk('two', 101)], session_seconds=1,
                              recognize_override=slow, clock_override=lambda: now[0])
        self.assertEqual(result['error']['code'], 'session-timeout')
        self.assertEqual(result['chunks'], 1)
        self.assertFalse(any(event['type'] == 'trial' for event in self.events))

    def test_persistence_crossing_deadline_cannot_publish_trial(self):
        now = [0]
        original = asr.save

        def slow_receipt(path, value):
            original(path, value)
            if path.name == 'receipt.json':
                now[0] = 2000

        with patch.object(asr, 'save', slow_receipt):
            result = self.execute([chunk()], session_seconds=1, clock_override=lambda: now[0])
        self.assertEqual(result['error']['code'], 'session-timeout')
        self.assertFalse(any(event['type'] == 'trial' for event in self.events))

    def test_expired_start_receipt_does_not_enter_recognizer(self):
        now = [0]
        original = asr.save

        def slow_start(path, value):
            original(path, value)
            if path.name == 'started.json':
                now[0] = 2000

        with patch.object(asr, 'save', slow_start):
            result = self.execute([chunk()], session_seconds=1, clock_override=lambda: now[0])
        self.assertEqual(result['error']['code'], 'session-timeout')
        self.assertEqual(self.calls, [])

    def test_protocol_is_utf8_decodable_even_with_windows_legacy_stdout_encoding(self):
        script = (
            'import importlib.util; '
            f's=importlib.util.spec_from_file_location("asr", {str(Path(asr.__file__))!r}); '
            'm=importlib.util.module_from_spec(s); s.loader.exec_module(m); '
            'm.emit_stream_event({"type":"trial","text":"\\u2212\\u00e9\\u03c3"})'
        )
        result = subprocess.run([sys.executable, '-B', '-c', script], capture_output=True,
                                env={**os.environ, 'PYTHONIOENCODING': 'cp1252'}, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr.decode('ascii', errors='replace'))
        self.assertEqual(json.loads(result.stdout.decode('utf-8'))['text'], '\u2212\u00e9\u03c3')


if __name__ == '__main__':
    unittest.main()
