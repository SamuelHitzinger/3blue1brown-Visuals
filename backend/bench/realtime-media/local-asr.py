"""Local ASR feasibility probe. Download public weights separately; run forbids sockets.

Install faster-whisper into .tmp/realtime-media/asr-python, then use --help.
No transcription service, generated reference transcript, or automatic upload exists.
"""
import argparse
import base64
import binascii
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import queue
import re
import sys
import threading
import time
import uuid
import wave

REPO = Path(__file__).resolve().parents[3]
PACKAGES = REPO / '.tmp/realtime-media/asr-python'
sys.path.insert(0, str(PACKAGES))

MAX_PCM_BYTES = 8 * 16000 * 2
MAX_LINE_BYTES = 4 * ((MAX_PCM_BYTES + 2) // 3) + 2048


def emit_stream_event(event):
    # ASCII JSON escapes preserve Unicode while remaining UTF-8-compatible even
    # when piped stdout uses a legacy Windows code page.
    print(json.dumps(event, ensure_ascii=True, allow_nan=False), flush=True)


class StreamProtocolError(ValueError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


class BoundedLines:
    """Bounded read-ahead; a daemon permits idle shutdown while stdin is open."""
    def __init__(self, stream, clock=lambda: time.perf_counter() * 1000):
        self.items = queue.Queue(maxsize=1)
        self.stopped = threading.Event()

        def put(value):
            while not self.stopped.is_set():
                try:
                    self.items.put(value, timeout=.1)
                    return
                except queue.Full:
                    pass

        def read():
            try:
                pending = bytearray()
                while not self.stopped.is_set():
                    block = stream.read(65536)
                    if not block:
                        if pending:
                            raise StreamProtocolError('line-limit-or-missing-newline')
                        put(None)
                        return
                    pending.extend(block)
                    while b'\n' in pending:
                        end = pending.index(b'\n') + 1
                        if end > MAX_LINE_BYTES:
                            raise StreamProtocolError('line-limit-or-missing-newline')
                        line = bytes(pending[:end])
                        del pending[:end]
                        put((line, clock()))
                        if self.stopped.is_set():
                            return
                    if len(pending) >= MAX_LINE_BYTES:
                        raise StreamProtocolError('line-limit-or-missing-newline')
            except Exception as error:
                put(error)

        threading.Thread(target=read, daemon=True).start()

    def get(self, timeout):
        try:
            result = self.items.get(timeout=max(0, timeout))
        except queue.Empty:
            raise StreamProtocolError('input-timeout') from None
        if isinstance(result, Exception):
            raise result
        return result

    def close(self):
        self.stopped.set()


def decode_chunk(message):
    expected = {'type', 'id', 'sourceId', 'sourceStartSec', 'sourceEndSec', 'pcm16Base64'}
    if not isinstance(message, dict) or set(message) != expected or message['type'] != 'chunk':
        raise StreamProtocolError('chunk-fields')
    for field in ('id', 'sourceId'):
        if not isinstance(message[field], str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}', message[field]):
            raise StreamProtocolError('chunk-identity')
    start, end = message['sourceStartSec'], message['sourceEndSec']
    if any(type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 1e9 for value in (start, end)):
        raise StreamProtocolError('source-span')
    duration = end - start
    if not 0 < duration <= 8:
        raise StreamProtocolError('source-span')
    encoded = message['pcm16Base64']
    if not isinstance(encoded, str) or len(encoded) > 4 * ((MAX_PCM_BYTES + 2) // 3):
        raise StreamProtocolError('pcm-limit')
    try:
        pcm = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise StreamProtocolError('pcm-base64') from None
    if not pcm or len(pcm) > MAX_PCM_BYTES or len(pcm) % 2 or abs(len(pcm) / 32000 - duration) > 1e-7:
        raise StreamProtocolError('pcm-span-mismatch')
    return pcm


def strict_json(line):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise StreamProtocolError('duplicate-json-key')
            result[key] = value
        return result
    try:
        return json.loads(line, object_pairs_hook=pairs,
                          parse_constant=lambda _: (_ for _ in ()).throw(StreamProtocolError('nonfinite-json')))
    except (ValueError, UnicodeError, RecursionError) as error:
        if isinstance(error, StreamProtocolError):
            raise
        raise StreamProtocolError('invalid-json') from None


def process_stream(input_stream, emit, output, recognize, startup, *, clock=lambda: time.perf_counter() * 1000,
                   max_chunks=120, max_audio_seconds=480, idle_seconds=30, session_seconds=600):
    """Serial observed inference. No source pacing, network, browser, or model calls here.

    recognize is the already-loaded local recognizer, injected in unit tests.
    Session/idle bounds are checked between operations; native inference itself
    requires a host process timeout for hard cancellation.
    """
    if (type(max_chunks) is not int or not 1 <= max_chunks <= 512
            or any(type(value) not in (int, float) or not math.isfinite(value)
                   for value in (max_audio_seconds, idle_seconds, session_seconds))
            or not 0 < max_audio_seconds <= 4096 or not 0 < idle_seconds <= 300
            or not 0 < session_seconds <= 3600):
        raise StreamProtocolError('stream-limits')
    started = clock()
    reader = BoundedLines(input_stream, clock)
    seen, total_bytes, count = set(), 0, 0
    result = {'status': 'running', 'chunks': 0, 'pcmBytes': 0, 'clockDomain': startup['clockDomain']}
    active = None
    try:
        emit({'type': 'ready', **startup, 'readyAtMs': started,
              'limits': {'maxChunkSeconds': 8, 'maxLineBytes': MAX_LINE_BYTES,
                         'maxChunks': max_chunks, 'maxAudioSeconds': max_audio_seconds,
                         'idleSeconds': idle_seconds, 'sessionSeconds': session_seconds},
              'clock': 'Python perf_counter milliseconds; process domain only. Calibrate before joining host clocks.',
              'limitation': 'Observed chunk inference, not proof of live source capture or causal source pacing.'})
        while True:
            remaining = session_seconds - (clock() - started) / 1000
            if remaining <= 0:
                raise StreamProtocolError('session-timeout')
            incoming = reader.get(min(idle_seconds, remaining))
            dequeued = clock()
            if dequeued - started >= session_seconds * 1000:
                raise StreamProtocolError('session-timeout')
            if incoming is None:
                result.update(status='complete', reason='eof')
                break
            line, received = incoming
            message = strict_json(line)
            if message == {'type': 'shutdown'}:
                result.update(status='complete', reason='shutdown')
                break
            pcm = decode_chunk(message)
            if message['id'] in seen:
                raise StreamProtocolError('duplicate-id')
            if count >= max_chunks:
                raise StreamProtocolError('chunk-budget')
            if total_bytes + len(pcm) > max_audio_seconds * 32000:
                raise StreamProtocolError('audio-budget')
            seen.add(message['id'])
            active = output / f'chunk-{count:04d}'
            active.mkdir(exist_ok=False)
            metadata = {key: value for key, value in message.items() if key != 'pcm16Base64'}
            metadata.update(pcmBytes=len(pcm), pcmSha256=hashlib.sha256(pcm).hexdigest(),
                            sampleRate=16000, channels=1, sampleFormat='pcm16le')
            save(active / 'input.json', metadata)
            with (active / 'audio.pcm').open('xb') as stream:
                stream.write(pcm)
            if clock() - started >= session_seconds * 1000:
                raise StreamProtocolError('session-timeout')
            receipt = {'id': message['id'], 'sourceId': message['sourceId'], 'index': count,
                       'clockDomain': startup['clockDomain'], 'receivedAtMs': received,
                       'dequeuedAtMs': dequeued,
                       'inferenceStartedAtMs': clock()}
            save(active / 'started.json', receipt)
            emit({'type': 'inference-start', **receipt})
            if clock() - started >= session_seconds * 1000:
                raise StreamProtocolError('session-timeout')
            segments, info = recognize(pcm)
            records, first_segment_ms = [], None
            offset = message['sourceStartSec']
            duration = message['sourceEndSec'] - offset
            for segment in segments:
                if len(records) >= 200:
                    raise StreamProtocolError('recognizer-output-limit')
                if first_segment_ms is None:
                    first_segment_ms = clock() - receipt['inferenceStartedAtMs']
                words = list(segment.words or [])
                if len(words) > 2000 or not isinstance(segment.text, str) or len(segment.text) > 40000:
                    raise StreamProtocolError('recognizer-output-limit')
                record = {**absolute_span(segment.start, segment.end, offset), 'text': segment.text,
                          'words': [{**absolute_span(word.start, word.end, offset), 'word': word.word,
                                     'probability': float(word.probability)} for word in words]}
                records.append(record)
            completed = clock()
            receipt['inferenceCompletedAtMs'] = completed
            elapsed = completed - receipt['inferenceStartedAtMs']
            trial = {'index': count, 'kind': 'cold' if count == 0 else 'warm', 'windowIndex': count, 'pass': 0,
                     'windowStartSec': 0, 'windowEndSec': duration,
                     'sourceWindowStartSec': offset, 'sourceWindowEndSec': message['sourceEndSec'],
                     'availableAfterSourceSec': message['sourceEndSec'], 'inferenceMs': elapsed,
                     'firstSegmentMs': first_segment_ms, 'realTimeFactor': elapsed / (1000 * duration),
                     'language': info.language, 'languageProbability': float(info.language_probability),
                     'text': ''.join(segment['text'] for segment in records).strip(), 'segments': records}
            # Keep exact recognizer output; timing.ts applies its own acceptance
            # checks. Do not repair estimated words or claim source-time arrival.
            save(active / 'trial.json', trial)
            save(active / 'receipt.json', receipt)
            count += 1
            total_bytes += len(pcm)
            if clock() - started >= session_seconds * 1000:
                raise StreamProtocolError('session-timeout')
            emit({'type': 'trial', 'trial': trial, 'receipt': receipt,
                  'trialRef': str(active / 'trial.json'), 'pcmSha256': metadata['pcmSha256']})
            active = None
    except Exception as error:
        failure = {'code': error.code if isinstance(error, StreamProtocolError) else 'stream-failed',
                   'exceptionType': type(error).__name__}
        result.update(status='failed', error=failure)
        if active is not None:
            save(active / 'failure.json', failure)
    finally:
        reader.close()
        result.update(chunks=count, pcmBytes=total_bytes, finishedAtMs=clock())
        save(output / 'result.json', result)
    emit({'type': 'complete' if result['status'] == 'complete' else 'error', **result})
    return result


def stream(args):
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
    os.environ['HF_DATASETS_OFFLINE'] = '1'
    sys.addaudithook(deny_network)
    output = args.out.resolve()
    output.mkdir(parents=True, exist_ok=False)
    startup = {'evidenceKind': 'local-asr-stdin-stream', 'clockDomain': f'python-perf-counter:{uuid.uuid4()}',
               'modelPath': str(args.model_path.resolve()), 'sourceSha256': sha256(__file__),
               'networkDisabled': True, 'device': args.device, 'computeType': args.compute_type,
               'cpuThreads': args.threads, 'beamSize': args.beam_size, 'languageRequested': args.language,
               'settings': {'word_timestamps': True, 'vad_filter': False, 'condition_on_previous_text': False,
                            'temperature': 0, 'initial_prompt': None}}
    save(output / 'started.json', startup)
    try:
        imported = time.perf_counter()
        from faster_whisper import WhisperModel
        import numpy as np
        startup['importMs'] = (time.perf_counter() - imported) * 1000
        startup['versions'] = {name: importlib.metadata.version(name) for name in ('faster-whisper', 'ctranslate2', 'numpy')}
        loaded = time.perf_counter()
        model = WhisperModel(startup['modelPath'], device=args.device, compute_type=args.compute_type,
                             cpu_threads=args.threads, num_workers=1, local_files_only=True)
        startup['modelLoadMs'] = (time.perf_counter() - loaded) * 1000
    except Exception as error:
        failure = {'status': 'failed', 'error': {'code': 'startup-failed', 'exceptionType': type(error).__name__}, **startup}
        save(output / 'result.json', failure)
        emit_stream_event({'type': 'error', **failure})
        return 1
    save(output / 'ready.json', startup)

    def recognize(pcm):
        samples = np.frombuffer(pcm, dtype='<i2').astype(np.float32) / 32768.0
        return model.transcribe(samples, language=args.language, beam_size=args.beam_size,
                                word_timestamps=True, vad_filter=False, condition_on_previous_text=False, temperature=0)

    # A daemon blocked in BufferedReader at interpreter shutdown can hold its
    # lock. Give the reader an unbuffered duplicate; OS process exit closes it.
    input_stream = os.fdopen(os.dup(sys.stdin.fileno()), 'rb', buffering=0)
    result = process_stream(input_stream, emit_stream_event,
                            output, recognize, startup, max_chunks=args.max_chunks, max_audio_seconds=args.max_audio_seconds,
                            idle_seconds=args.idle_seconds, session_seconds=args.session_seconds)
    return 0 if result['status'] == 'complete' else 1


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def save(path, value):
    with Path(path).open('x', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)


def absolute_span(start, end, offset):
    return {'startSec': float(start), 'endSec': float(end),
            'sourceStartSec': float(start + offset), 'sourceEndSec': float(end + offset)}


def deny_network(event, _args):
    if event in ('socket.connect', 'socket.getaddrinfo', 'socket.sendto'):
        raise RuntimeError('Network disabled during local audio inference')


def download(args):
    # Only this subcommand can access the network; it never accepts an audio file.
    from huggingface_hub import HfApi, snapshot_download
    cache = args.cache.resolve()
    cache.mkdir(parents=True, exist_ok=True)
    repo_id = f'Systran/faster-whisper-{args.model}'
    started = time.perf_counter()
    metadata = HfApi(token=False).model_info(repo_id)
    path = Path(snapshot_download(repo_id, revision=metadata.sha, cache_dir=cache,
                                 token=False, allow_patterns=['config.json', 'preprocessor_config.json',
                                 'model.bin', 'tokenizer.json', 'vocabulary.*']))
    files = [{'name': p.name, 'bytes': p.stat().st_size, 'sha256': sha256(p)}
             for p in sorted(path.iterdir()) if p.is_file()]
    receipt = {'source': f'https://huggingface.co/{repo_id}', 'revision': metadata.sha,
               'downloadSec': time.perf_counter() - started, 'snapshot': str(path),
               'files': files, 'totalBytes': sum(p['bytes'] for p in files)}
    destination = cache / f'download-{args.model}-{time.time_ns()}.json'
    save(destination, receipt)
    print(json.dumps({'receipt': str(destination), **receipt}, ensure_ascii=False))


def run(args):
    # Defense in depth: both Hugging Face offline flags and a Python network audit.
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
    os.environ['HF_DATASETS_OFFLINE'] = '1'
    sys.addaudithook(deny_network)
    output = args.out.resolve()
    output.mkdir(parents=True, exist_ok=False)
    audio = args.audio.resolve()
    model_path = args.model_path.resolve()
    started = time.perf_counter()
    with wave.open(str(audio), 'rb') as wav:
        audio_info = {'sampleRate': wav.getframerate(), 'channels': wav.getnchannels(),
                      'sampleWidth': wav.getsampwidth(), 'durationSec': wav.getnframes() / wav.getframerate(),
                      'bytes': audio.stat().st_size}
        if (wav.getframerate(), wav.getnchannels(), wav.getsampwidth(), wav.getcomptype()) != (16000, 1, 2, 'NONE'):
            raise ValueError('Use an uncompressed mono 16 kHz PCM16 WAV for this controlled probe.')
        pcm = wav.readframes(wav.getnframes())
    identity = {'evidenceKind': 'offline-local-asr', 'audio': str(audio), 'audioSha256': sha256(audio),
                'audioInfo': audio_info, 'sourceOffsetSec': args.offset, 'languageRequested': args.language,
                'modelPath': str(model_path), 'device': args.device, 'computeType': args.compute_type,
                'cpuThreads': args.threads, 'beamSize': args.beam_size, 'runs': args.runs,
                'chunkSeconds': args.chunk_seconds, 'pastOnlyIndependentWindows': args.chunk_seconds > 0,
                'networkDisabled': True, 'sourceSha256': sha256(__file__),
                'settings': {'word_timestamps': True, 'vad_filter': False, 'condition_on_previous_text': False,
                             'temperature': 0, 'initial_prompt': None},
                'limitation': 'Cold means first inference in this process after model loading, not an uncached disk or machine boot. Warm uses the same loaded model. Word timestamps are model estimates. No reference transcript or WER measurement.'}
    save(output / 'started.json', identity)
    result = {**identity, 'status': 'running', 'trials': []}
    try:
        import_started = time.perf_counter()
        from faster_whisper import WhisperModel
        import ctranslate2
        import numpy as np
        result['importMs'] = (time.perf_counter() - import_started) * 1000
        result['versions'] = {name: importlib.metadata.version(name) for name in
                              ['faster-whisper', 'ctranslate2', 'av', 'numpy', 'huggingface-hub']}
        result['cpuComputeTypes'] = sorted(ctranslate2.get_supported_compute_types('cpu'))
        result['cudaDeviceCount'] = ctranslate2.get_cuda_device_count()
        load_started = time.perf_counter()
        model = WhisperModel(str(model_path), device=args.device, compute_type=args.compute_type,
                             cpu_threads=args.threads, num_workers=1, local_files_only=True)
        result['modelLoadMs'] = (time.perf_counter() - load_started) * 1000
        sample_count = len(pcm) // 2
        window_samples = int(args.chunk_seconds * 16000) if args.chunk_seconds else sample_count
        windows = [(start, min(start + window_samples, sample_count)) for start in range(0, sample_count, window_samples)]
        for trial_index in range(args.runs * len(windows)):
            window_index = trial_index % len(windows)
            window_start, window_end = windows[window_index]
            offset = args.offset + window_start / 16000
            window_duration = (window_end - window_start) / 16000
            inference_started = time.perf_counter()
            # Standard WAV decoding avoids PyAV version-dependent codec APIs and
            # guarantees the exact declared sample rate; conversion is timed.
            samples = np.frombuffer(pcm[window_start * 2:window_end * 2], dtype='<i2').astype(np.float32) / 32768.0
            segments, info = model.transcribe(samples, language=args.language, beam_size=args.beam_size,
                                             word_timestamps=True, vad_filter=False,
                                             condition_on_previous_text=False, temperature=0)
            records, first_segment_ms = [], None
            for segment in segments:
                if first_segment_ms is None:
                    first_segment_ms = (time.perf_counter() - inference_started) * 1000
                records.append({**absolute_span(segment.start, segment.end, offset), 'text': segment.text,
                                'words': [{**absolute_span(w.start, w.end, offset), 'word': w.word,
                                           'probability': float(w.probability)} for w in segment.words or []]})
            elapsed = (time.perf_counter() - inference_started) * 1000
            trial = {'index': trial_index, 'kind': 'cold' if trial_index == 0 else 'warm',
                     'pass': trial_index // len(windows), 'windowIndex': window_index,
                     'windowStartSec': window_start / 16000, 'windowEndSec': window_end / 16000,
                     'sourceWindowStartSec': offset, 'sourceWindowEndSec': offset + window_duration,
                     'availableAfterSourceSec': offset + window_duration,
                     'inferenceMs': elapsed, 'firstSegmentMs': first_segment_ms,
                     'realTimeFactor': elapsed / (1000 * window_duration),
                     'language': info.language, 'languageProbability': float(info.language_probability),
                     'text': ''.join(segment['text'] for segment in records).strip(), 'segments': records}
            save(output / f'trial-{trial_index}.json', trial)
            result['trials'].append(trial)
            print(json.dumps({k: v for k, v in trial.items() if k != 'segments'}, ensure_ascii=False), flush=True)
        result['status'] = 'complete'
    except Exception as error:
        result['status'] = 'failed'
        result['error'] = {'type': type(error).__name__, 'message': str(error)[:2000]}
        raise
    finally:
        result['elapsedMs'] = (time.perf_counter() - started) * 1000
        save(output / 'result.json', result)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    prepare = commands.add_parser('download', help='Download public weights only; no private input.')
    prepare.add_argument('--model', choices=['tiny', 'base', 'small'], default='tiny')
    prepare.add_argument('--cache', type=Path, default=REPO / '.tmp/realtime-media/models')
    execute = commands.add_parser('run', help='Transcribe locally with all socket connections blocked.')
    execute.add_argument('--audio', type=Path, required=True)
    execute.add_argument('--model-path', type=Path, required=True)
    execute.add_argument('--out', type=Path, required=True)
    execute.add_argument('--offset', type=float, required=True)
    execute.add_argument('--language', default='de')
    execute.add_argument('--device', choices=['cpu', 'cuda'], default='cpu')
    execute.add_argument('--compute-type', choices=['int8', 'int8_float32', 'float16', 'float32'], default='int8')
    execute.add_argument('--threads', type=int, default=8)
    execute.add_argument('--beam-size', type=int, choices=range(1, 6), default=1)
    execute.add_argument('--runs', type=int, choices=range(1, 6), default=2)
    execute.add_argument('--chunk-seconds', type=int, choices=[0, 2, 4, 6], default=0)
    receiver = commands.add_parser('stream', help='Read bounded NDJSON PCM chunks; local inference, no source file reads.')
    receiver.add_argument('--model-path', type=Path, required=True)
    receiver.add_argument('--out', type=Path, required=True)
    receiver.add_argument('--language', default='en')
    receiver.add_argument('--device', choices=['cpu', 'cuda'], default='cpu')
    receiver.add_argument('--compute-type', choices=['int8', 'int8_float32', 'float16', 'float32'], default='int8')
    receiver.add_argument('--threads', type=int, choices=range(1, 33), default=8)
    receiver.add_argument('--beam-size', type=int, choices=range(1, 6), default=1)
    receiver.add_argument('--max-chunks', type=int, choices=range(1, 513), default=120)
    receiver.add_argument('--max-audio-seconds', type=int, choices=range(1, 4097), default=480)
    receiver.add_argument('--idle-seconds', type=int, choices=range(1, 301), default=30)
    receiver.add_argument('--session-seconds', type=int, choices=range(1, 3601), default=600)
    commands.add_parser('self-test')
    args = parser.parse_args()
    if args.command == 'download':
        download(args)
    elif args.command == 'run':
        run(args)
    elif args.command == 'stream':
        raise SystemExit(stream(args))
    else:
        assert absolute_span(.25, .75, 885) == {'startSec': .25, 'endSec': .75, 'sourceStartSec': 885.25, 'sourceEndSec': 885.75}
        import socket
        sys.addaudithook(deny_network)
        try:
            with socket.socket() as check:
                check.connect(('127.0.0.1', 9))
            raise AssertionError('Network guard did not reject a connection')
        except RuntimeError:
            pass
        print('Offset and network-guard self-tests passed; no model or audio loaded.')


if __name__ == '__main__':
    main()
