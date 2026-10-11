#!/usr/bin/env python3
"""Exercise release image streaming without Docker or production access."""
import io
import os
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path


class ReleaseStreamTests(unittest.TestCase):
    def run_release(self, prefix="./", include_image=True, load_failure=False, disk_full=False):
        with tempfile.TemporaryDirectory(prefix="aha-release-stream-") as directory:
            root = Path(directory)
            base, commands = root / "base", root / "bin"
            commands.mkdir()
            revision = "a" * 40
            image_id = "sha256:" + "b" * 64
            payload = b"saved image bytes\x00\xff" * 1024
            files = {
                "REVISION": revision.encode(),
                "IMAGE_TAG": f"3yellow3white:{revision}".encode(),
                "compose.yaml": b"services: {}\n",
                "scripts/smoke-container.sh": b"touch \"$STREAM_ROOT/smoked\"\n",
                "scripts/cleanup-images.py": b"""import os, sys
from pathlib import Path
assert '--apply' not in sys.argv, 'Check mode must not delete images'
assert '--lock-fd' in sys.argv and '--archive' in sys.argv
assert os.fstat(9).st_ino == (Path(os.environ['STREAM_ROOT']) / 'base/deploy.lock').stat().st_ino
if os.environ['STREAM_DISK_FULL'] == '1':
    sys.exit('Insufficient disk space')
""",
                "scripts/container-config.py": b"""import os, sys
from pathlib import Path
release = Path(sys.argv[1])
assert not (release / 'image.tar.gz').exists()
(release / 'compose.env').write_text('')
(Path(os.environ['STREAM_ROOT']) / 'configured').touch()
""",
            }
            if include_image:
                files["image.tar.gz"] = payload
            archive = root / "release.tar.gz"
            with tarfile.open(archive, "w:gz") as bundle:
                for name, data in files.items():
                    member = tarfile.TarInfo(prefix + name)
                    member.size = len(data)
                    bundle.addfile(member, io.BytesIO(data))

            stubs = {
                "id": "#!/bin/sh\necho deploy\n",
                "systemctl": """#!/bin/sh
if [ "$1" = is-enabled ] && [ "$2" = docker ]; then
  echo enabled
else
  exit 1
fi
""",
                "sudo": f"""#!/bin/sh
shift
[ "$1" = docker ] || exit 1
shift
case "$1 $2" in
  'info ') exit 0 ;;
  'compose version') echo 2.30.0 ;;
  'ps -aq') exit 0 ;;
  'image load')
    [ "$#" = 2 ] || exit 1
    cat > "$STREAM_ROOT/loaded-image"
    [ "$STREAM_LOAD_FAILURE" = 0 ] ;;
  'image inspect')
    case "$4" in
      '{{{{.Id}}}}') echo '{image_id}' ;;
      *) echo '{revision}' ;;
    esac ;;
  'compose --project-name') exit 0 ;;
  *) exit 1 ;;
esac
""",
            }
            for name, content in stubs.items():
                path = commands / name
                path.write_text(content)
                path.chmod(0o755)
            source = Path(__file__).with_name("deploy-release.sh").read_text()
            source = source.replace("base=/srv/apps/3yellow3white-actions", f"base={base}")
            script = root / "deploy.sh"
            script.write_text(source)
            environment = {
                **os.environ,
                "PATH": str(commands) + os.pathsep + os.environ["PATH"],
                "STREAM_ROOT": str(root),
                "STREAM_LOAD_FAILURE": "1" if load_failure else "0",
                "STREAM_DISK_FULL": "1" if disk_full else "0",
            }
            result = subprocess.run(
                ["bash", str(script), str(archive), revision, "--check"],
                env=environment, capture_output=True, text=True,
            )
            if include_image and not load_failure and not disk_full:
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual((root / "loaded-image").read_bytes(), payload)
                self.assertTrue((root / "smoked").exists())
                self.assertTrue((root / "configured").exists())
            else:
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertFalse((root / "smoked").exists())
                self.assertFalse((root / "configured").exists())
            self.assertEqual(list((base / "releases").iterdir()), [])
            self.assertFalse((base / "docker-current").exists())
            self.assertTrue(archive.exists())
            if disk_full:
                self.assertFalse((root / 'loaded-image').exists())

    def test_streams_packaged_image_without_extracting_a_duplicate(self):
        self.run_release()

    def test_accepts_archive_with_unprefixed_member_names(self):
        self.run_release(prefix="")

    def test_missing_image_stops_before_candidate_validation(self):
        self.run_release(include_image=False)

    def test_failed_docker_load_stops_before_candidate_validation(self):
        self.run_release(load_failure=True)

    def test_full_disk_stops_before_loading_image(self):
        self.run_release(disk_full=True)


if __name__ == "__main__":
    unittest.main()
