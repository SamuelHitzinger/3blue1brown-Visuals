#!/usr/bin/env python3
"""Prepare private CI deployment files without contacting the production server."""
import os
import re
import sys
from pathlib import Path


def prepare_ssh():
    for name in ('VM_SSH_PRIVATE_KEY', 'VM_SSH_KNOWN_HOSTS', 'VM_HOST', 'VM_SSH_USER'):
        if not os.environ.get(name):
            raise SystemExit(f'Missing deployment setting: {name}')
    host, user = os.environ['VM_HOST'], os.environ['VM_SSH_USER']
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9.-]*', host):
        raise SystemExit('Invalid VM_HOST')
    if not re.fullmatch(r'[a-z_][a-z0-9_-]*', user):
        raise SystemExit('Invalid VM_SSH_USER')
    directory = Path(os.environ['RUNNER_TEMP']) / 'aha-ssh'
    directory.mkdir(mode=0o700)
    for name, value in [('key', os.environ['VM_SSH_PRIVATE_KEY']), ('known_hosts', os.environ['VM_SSH_KNOWN_HOSTS'])]:
        path = directory / name
        path.write_text(value.rstrip() + '\n')
        path.chmod(0o600)
    config = directory / 'config'
    config.write_text(f"""Host aha-prod
      HostName {host}
      User {user}
      IdentityFile {directory}/key
      UserKnownHostsFile {directory}/known_hosts
      IdentitiesOnly yes
      BatchMode yes
      StrictHostKeyChecking yes
      ConnectTimeout 15
      ServerAliveInterval 15
      ServerAliveCountMax 4
    """)
    config.chmod(0o600)


def prepare_environment():
    os.umask(0o077)
    lines = []
    for name in ('ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'ELEVENLABS_MODEL_ID', 'NARRATION_PUBLIC_ORIGIN'):
        value = os.environ.get(name, '')
        if not value or any(char in value for char in '\r\n\x00'):
            raise SystemExit(f'Missing or invalid deployment setting: {name}')
        escaped = value.replace('\\', '\\\\').replace('"', '\\"')
        lines.append(f'{name}="{escaped}"\n')
    path = Path(os.environ['RUNNER_TEMP']) / 'aha-ssh' / 'deployment.env'
    path.write_text(''.join(lines))
    path.chmod(0o600)


if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in ('ssh', 'env'):
        raise SystemExit('Usage: prepare-deployment.py ssh|env')
    if sys.argv[1] == 'ssh':
        prepare_ssh()
    else:
        prepare_environment()
