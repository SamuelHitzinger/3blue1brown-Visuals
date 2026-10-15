"""Local ASR feasibility probe. Download public weights separately; run forbids sockets.

Install faster-whisper into .tmp/realtime-media/asr-python, then use --help.
No transcription service, generated reference transcript, or automatic upload exists.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import sys
import time
import wave

REPO = Path(__file__).resolve().parents[3]
PACKAGES = REPO / '.tmp/realtime-media/asr-python'
sys.path.insert(0, str(PACKAGES))


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
    commands.add_parser('self-test')
    args = parser.parse_args()
    if args.command == 'download':
        download(args)
    elif args.command == 'run':
        run(args)
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
