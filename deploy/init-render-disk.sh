#!/bin/sh
# Fixed paths on the mounted disk; the API process runs as parish.
set -eu
for dir in /var/data/uploads /var/data/model-cache; do
  if [ -L "$dir" ]; then echo "Unexpected symbolic link on the volume" >&2; exit 1; fi
  install -d -m 0700 -o parish -g parish "$dir"
done
