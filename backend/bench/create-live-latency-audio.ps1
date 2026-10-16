param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $OutputDirectory) { throw 'Use a new evidence directory.' }
New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
$targetDirectory = (Resolve-Path -LiteralPath $OutputDirectory).Path
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice('Microsoft Zira Desktop')
$speaker.Rate = 0
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$cues = @(
  @{id='create'; startMs=0; text='Consider a cube.'},
  @{id='motion'; startMs=6000; text='The cube moves right at one unit per second.'},
  @{id='stop'; startMs=14000; text='Stop the cube.'},
  @{id='replace'; startMs=20000; text='Change the cube into a sphere.'}
)
try {
  foreach ($cue in $cues) {
    $cue.file = Join-Path $targetDirectory ($cue.id + '.wav')
    $speaker.SetOutputToWaveFile($cue.file, $format)
    $speaker.Speak($cue.text)
    $speaker.SetOutputToNull()
  }
} finally { $speaker.Dispose() }
@{voice='Microsoft Zira Desktop'; sampleRate=16000; durationMs=24000; cues=$cues} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $targetDirectory 'speech.json') -Encoding UTF8
Write-Output "Synthetic speech saved to $targetDirectory"
