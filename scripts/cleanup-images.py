#!/usr/bin/env python3
"""Retain the current app image and two rollback images. Dry-run by default."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

BASE = Path('/srv/apps/3yellow3white-actions')
IMAGE_ID = re.compile(r'sha256:[0-9a-f]{64}')
APP_TAG = re.compile(r'3yellow3white:(?:[0-9a-f]{40}|docker-validation)')
GIB = 1024 ** 3


def docker(*args):
    return subprocess.check_output(['sudo', '-n', 'docker', *args], text=True)


def retained_images(base):
    """Fail closed on broken recovery references; never evaluate runtime.env."""
    current = base / 'docker-current'
    if not current.is_symlink():
        raise ValueError('No docker-current symlink; image cleanup requires an activated Docker release')
    keep, visited = set(), set()
    for _ in range(3):
        release = current.resolve(strict=True)
        if release.parent != (base / 'releases').resolve() or release in visited:
            raise ValueError(f'Invalid rollback reference: {current}')
        visited.add(release)
        values = [line.removeprefix('AHA_IMAGE=') for line in
                  (release / 'compose.env').read_text().splitlines() if line.startswith('AHA_IMAGE=')]
        if len(values) != 1 or not IMAGE_ID.fullmatch(values[0]):
            raise ValueError(f'Invalid image reference in {release}/compose.env')
        keep.add(values[0])
        current = release / 'previous-docker'
        if not current.is_symlink():
            if current.exists():
                raise ValueError(f'Invalid rollback reference: {current}')
            break
    return keep


def candidates(images, keep, protected_tags):
    return [item for item in images if item['Id'] not in keep
            and item.get('RepoTags')
            and all(APP_TAG.fullmatch(tag) for tag in item['RepoTags'])
            and not set(item['RepoTags']).intersection(protected_tags)]


def check_space(paths, required):
    for path in paths:
        available = shutil.disk_usage(path).free
        print(f'Disk space at {path}: {available / GIB:.1f} GiB available; '
              f'{required / GIB:.1f} GiB required', flush=True)
        if available < required:
            raise ValueError(f'Insufficient disk space at {path}; refusing to load another image')


def cleanup(base, apply, protected_tags):
    keep = retained_images(base)
    # Inspect every container, including stopped containers and other projects.
    container_ids = docker('ps', '-aq').split()
    if container_ids:
        keep.update(item['Image'] for item in json.loads(docker('inspect', *container_ids)))
    image_ids = sorted(set(docker('image', 'ls', '-q', '--no-trunc').split()))
    images = json.loads(docker('image', 'inspect', *image_ids)) if image_ids else []
    if not keep.issubset({item['Id'] for item in images}):
        raise ValueError('A retained image is missing; refusing cleanup until rollback references are repaired')
    obsolete = candidates(images, keep, protected_tags)
    print(f'{"Removing" if apply else "Would remove"} {len(obsolete)} obsolete app images; '
          f'preserving {len(keep)} active/rollback/container images', flush=True)
    for item in obsolete:
        print(' '.join(item['RepoTags']), flush=True)
        if apply:
            # No force: Docker also refuses deletion if a container acquired this image.
            subprocess.run(['sudo', '-n', 'docker', 'image', 'rm', item['Id']], check=True,
                           stdout=subprocess.DEVNULL)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', type=Path, default=BASE)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--protect-image', action='append', default=[])
    parser.add_argument('--lock-fd', type=int, help='Inherit the deployment lock from deploy-release.sh')
    parser.add_argument('--archive', type=Path, help='Also require room for loading this release')
    args = parser.parse_args()
    base = args.base.resolve(strict=True)
    lock_path = base / 'deploy.lock'
    lock_fd = args.lock_fd
    if lock_fd is None:
        lock_fd = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o600)
    elif (os.fstat(lock_fd).st_dev, os.fstat(lock_fd).st_ino) != (lock_path.stat().st_dev, lock_path.stat().st_ino):
        raise ValueError('Inherited descriptor is not the deployment lock')
    # Never prune while a deployment is loading, validating, activating or rolling back.
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        if args.lock_fd is not None or args.archive:
            raise
        print('Deployment in progress; skipping image retention', flush=True)
        return
    if (base / 'docker-current').is_symlink() or (base / 'docker-current').exists():
        cleanup(base, args.apply, args.protect_image)
    else:
        print('First Docker activation: preserving existing images', flush=True)
    if args.archive:
        required = max(8 * GIB, args.archive.stat().st_size * 4 + 2 * GIB)
        docker_root = Path(docker('info', '--format', '{{.DockerRootDir}}').strip())
        paths = [base, docker_root]
        # Docker 29 stores image content separately from DockerRootDir on this VM.
        if Path('/var/lib/containerd').exists():
            paths.append(Path('/var/lib/containerd'))
        check_space(paths, required)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        sys.exit(f'Image retention stopped: {error}')
