"""Read-only video inspection: decoded stills and labeled review contact sheets."""
from pathlib import Path
import hashlib
import json
import subprocess
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
SOURCE = Path(r"C:\Users\samue\Downloads\showcase.mp4")
FFMPEG = ROOT / "data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
FONT = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 16)

def frame(source, time):
    args = [str(FFMPEG), "-hide_banner", "-loglevel", "error", "-ss", str(time),
            "-i", str(source), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"]
    return Image.open(BytesIO(subprocess.run(args, check=True, capture_output=True).stdout)).convert("RGB")

def sheet(name, source, times, columns=4):
    rows = (len(times) + columns - 1) // columns
    image = Image.new("RGB", (columns * 320, rows * 204), "#141822")
    draw = ImageDraw.Draw(image)
    for i, time in enumerate(times):
        x, y = (i % columns) * 320, (i // columns) * 204
        image.paste(frame(source, time).resize((320, 180)), (x, y))
        draw.text((x + 8, y + 183), f"{time:.2f} s", font=FONT, fill="#ffffff")
    image.save(OUT / name)

metadata = subprocess.run([str(FFMPEG), "-hide_banner", "-i", str(SOURCE),
                           "-map", "0:v:0", "-f", "null", "NUL"], capture_output=True, text=True)
(OUT / "showcase-decode.txt").write_text(metadata.stderr, encoding="utf-8")
overview = [3.8, 13.2, 21.45, 29.9, 37.3, 44.9, 51.5, 56, 62.8, 74.04, 85.5, 99.1]
sheet("showcase-overview.png", SOURCE, overview)
sheet("showcase-peptide-48-to-52p75.png", SOURCE, [48 + i / 4 for i in range(20)])
sheet("showcase-peptide-53-to-57p75.png", SOURCE, [53 + i / 4 for i in range(20)])
sheet("showcase-translation-98-to-103p75.png", SOURCE, [98 + i / 4 for i in range(24)])
for time in [51.5, 56, 62.8, 74.04, 85.5, 99.1]:
    frame(SOURCE, time).save(OUT / f"showcase-{time:g}s.png")
pipeline = ROOT / "docs/demos/pipeline-peptide-20261011/demo.mp4"
sheet("pipeline-peptide-comparison.png", pipeline, [0, 5, 8.5, 10, 11, 12.5, 15, 19.5])
manifest = {
    "source": str(SOURCE), "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "sourceUnmodified": True, "decodeExitCode": metadata.returncode,
    "modality": "Decoded native stills and ordered 4 fps samples; no continuous playback",
    "overviewSeconds": overview,
    "denseIntervalsSeconds": [[48, 52.75], [53, 57.75], [98, 103.75]],
    "denseSampleRate": 4,
    "comparisonSource": str(pipeline),
    "comparisonSeconds": [0, 5, 8.5, 10, 11, 12.5, 15, 19.5]
}
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps(manifest, indent=2))
