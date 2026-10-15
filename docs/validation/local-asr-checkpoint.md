# Local ASR checkpoint — 2026-10-16

Local speech recognition is feasible on this machine without uploading lecture audio. This is an offline feasibility experiment, not a completed live audio-to-world implementation or an accuracy benchmark.

The existing production transcriber in `backend/src/lecture-transcription.ts` supports only external ElevenLabs and Deepgram APIs. The experiment is isolated in `backend/bench/realtime-media/local-asr.py`; no production settings changed.

## Runtime and provenance

- Bundled Python 3.12.14; faster-whisper 1.2.1; CTranslate2 4.8.3; NumPy 2.5.4; PyAV 19.0.1; huggingface-hub 2.2.0.
- Dependencies installed from PyPI into ignored `.tmp/realtime-media/asr-python`, approximately 277.1 MB; package download cache approximately 87.6 MB. No global installation.
- RTX 5080 is present, but cuBLAS12 and cuDNN9 DLLs could not be loaded. Tests explicitly used **CPU int8, eight threads, one worker, beam size 1**. GPU performance was not measured.
- Official implementation/documentation: [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper). Its documented CPU int8 and word-timestamp APIs are used.
- Model files were downloaded separately from the maintainer's Hugging Face repositories, with pinned revisions and per-file SHA-256 receipts. Download commands accept no audio. Inference sets Hugging Face offline flags, uses `local_files_only=True`, and installs a Python audit hook rejecting socket connections, address resolution and sendto calls.

| Multilingual model | Official source | Pinned revision | Downloaded model-package bytes |
| --- | --- | --- | ---: |
| tiny | [Systran/faster-whisper-tiny](https://huggingface.co/Systran/faster-whisper-tiny) | `d90ca5fe260221311c53c58e660288d3deb8d356` | 78,203,619 |
| base | [Systran/faster-whisper-base](https://huggingface.co/Systran/faster-whisper-base) | `ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66` | 147,882,941 |
| small | [Systran/faster-whisper-small](https://huggingface.co/Systran/faster-whisper-small) | `536b0662742c02347bc0e980a01041f333bce120` | 486,212,372 |

Download receipts are in `.tmp/realtime-media/models/download-{tiny,base,small}-*.json`. The model cache totals approximately 712.3 MB. These weights are multilingual, not English-only variants. No further model downloads were needed.

## Frozen audio and measurement

Both clips cover source time **885–905 seconds**, 20 seconds of mono 16 kHz PCM16 WAV. The German clip is `data/realtime-workshop/media/local-lecture/t0885-0905.wav`; the public English clip is `data/realtime-workshop/media/mit-oscillations/t0885-0905.wav`, extracted locally from the already downloaded public MIT lecture with FFmpeg 7.1. Every run records its input SHA-256, script SHA-256, model revision path and settings.

The timing starts before `model.transcribe(...)` and includes exhausting its lazy segment generator, word alignment and float-sample conversion. The full WAV read occurs before this timer. Import and model initialization are recorded separately. "Cold" means the first inference on the newly loaded model in that process, not an uncached operating-system boot; "warm" reuses that model. Download, capture-window accumulation, language-model reasoning and rendering are excluded. Language is explicitly supplied; reported languageProbability=1 is not independent language-detection evidence.

| Clip | Model | Import ms | Load ms | First inference ms | Warm inference ms |
| --- | --- | ---: | ---: | ---: | ---: |
| German | tiny | 248.6 | 151.5 | 285.4 | 178.5 |
| German | base | 253.2 | 211.5 | 354.4 | 294.6 |
| German | small | 255.6 | 547.2 | 1,081.9 | 999.8 |
| MIT English | tiny | 249.2 | 142.5 | 217.3 | 151.3 |
| MIT English | base | 248.6 | 217.2 | 325.3 | 272.9 |
| MIT English | small | 250.2 | 553.8 | 983.2 | 940.8 |

Results and actual segment/word transcripts: `data/realtime-workshop/asr/{local-lecture,mit-oscillations}-{tiny,base,small}-cpu-01/result.json`, except the successful German tiny run is `local-lecture-tiny-cpu-02`.

The first German tiny run remains failed and immutable: faster-whisper's PyAV decoder passed `metadata_errors` to PyAV 19, which rejects that argument. The controlled probe now reads PCM16 with Python's standard `wave` module and passes the exact normalized float samples to Whisper. It does not modify the installed dependency or silently substitute different audio.

## Actual recognition and limitations

The private German clip shows visible compound-word and word-boundary errors with tiny, partial improvement with base, and more coherent phrasing with small. Small still contains suspect words. No human reference transcript, word error rate, or certified scientific accuracy is available. Actual private speech and its exact recognition errors are retained only in ignored local data, not reproduced in this tracked checkpoint. The private German transcript has not been sent to any external model.

The public MIT full-clip base recognition includes `that is equal to minus omega square x`. Small produces `It's really weird why Professor D wants to do this` at the clipped beginning. Those are actual recognition outputs, not source-authoritative claims.

## Past-only four-second windows

Base was also run on five separate, non-overlapping windows from the same immutable clips: 885–889, 889–893, 893–897, 897–901 and 901–905 seconds. Only each window's samples reach the recognizer; `condition_on_previous_text=False`, no initial prompt and no future samples. All windows share one loaded model. A second identical pass provides warm measurements.

| Clip | First window ms | Remaining first-pass windows ms | Second pass ms |
| --- | ---: | --- | --- |
| German | 293.2 | 231.2, 224.0, 218.3, 210.8 | 218.8, 228.6, 222.0, 219.5, 211.3 |
| MIT English | 292.1 | 223.3, 220.1, 234.2, 223.6 | 226.1, 222.4, 221.5, 210.4, 207.1 |

Evidence: `data/realtime-workshop/asr/local-lecture-base-cpu-4s-01` and `data/realtime-workshop/asr/mit-oscillations-base-cpu-4s-01`.

MIT window 893–897 seconds actually returns `that is equal to minus omega square x.` in 220.1 ms. Word estimates include minus 894.12–894.70, omega 894.70–895.44, square 895.44–895.96, and x 895.96–896.72. This result becomes causally available only after source time 897 seconds plus recognition time, not at the estimated word start.

Boundary errors are material: the next four-second MIT window says `Okay, so we have software`; the full clip says `we have solved this problem`. German windows also split words and sentence fragments incorrectly. Therefore four-second collection plus approximately 0.23 seconds of recognition is plausible as a latency budget, but independent hard cuts are not ready to drive irreversible semantic edits. A subsequent experiment should use overlapping past-only context and stable-word reconciliation, retaining uncertainty at the boundary. The complete 20-second clips are retrospective accuracy comparisons; their collection delay fails a ten-second live deadline.

## Independent public-caption check

Only after recognition completed, the [official MIT lecture page](https://ocw.mit.edu/courses/8-03sc-physics-iii-vibrations-and-waves-fall-2016/resources/lecture-1-video/) supplied [its public VTT captions](https://ocw.mit.edu/courses/8-03sc-physics-iii-vibrations-and-waves-fall-2016/8085d63bf3f5547d9b04fa06bc67a179_4ysFC9vd3GE.vtt). The original download is retained at `data/realtime-workshop/media/mit-oscillations/official-lecture1.vtt`, SHA-256 `4d1a97f7dba0622cafc2a5dc588fc6d1c1a4c28d635ef14babeabb437dc8d9c8`. Captions were never supplied as a prompt or decoder context.

- Caption cue 885.390–888.810 identifies professor Lee; all three ASR sizes substitute Professor D. Tiny/base also lose words at the clipped opening; small preserves more of that phrase.
- Cue 893.680–898.000 contains `minus omega squared x`; all three full-clip transcripts and the four-second base window use square instead of squared. The scientific expression is recognizable, but this remains a literal transcription error.
- Cue 900.710–906.110 confirms solved and actually. Base full-clip substitutes naturally; small full-clip preserves actually. The 897–901 window cuts this cue near its beginning and yields the erroneous software phrase.

These are qualitative, cue-aligned checks, not exact WER: the captions provide phrase intervals, not word times, and the 885/905-second clip boundaries cut across caption cues. No manually corrected text replaces the raw ASR evidence.

## Reproduction

```powershell
$python = 'C:/Users/samue/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
& $python backend/bench/realtime-media/local-asr.py self-test
& $python backend/bench/realtime-media/local-asr.py run --audio=data/realtime-workshop/media/mit-oscillations/t0885-0905.wav --model-path=.tmp/realtime-media/models/models--Systran--faster-whisper-base/snapshots/ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66 --out=data/realtime-workshop/asr/NEW-RUN --offset=885 --language=en --runs=2 --chunk-seconds=4
```

Every output directory must be new. The CLI supports 2-, 4-, and 6-second windows; only the four-second window setting was measured here. Self-tests cover time-offset mapping and the network guard; Python syntax compilation passed. These small samples establish local runtime feasibility and visible recognition failure modes, not a universal latency or accuracy guarantee.
