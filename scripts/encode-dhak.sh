#!/bin/sh
# Encode the cut dhak WAVs to small AAC files (macOS afconvert), then drop the WAVs.
set -e
cd "$(dirname "$0")/../public/audio"
for f in dhak-hits dhak-rhythm; do
  afconvert -f m4af -d aac -b 96000 -c 1 "$f.wav" "$f.m4a"
  rm "$f.wav"
done
ls -la
