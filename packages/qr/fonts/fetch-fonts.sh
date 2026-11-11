#!/bin/sh
# Downloads the two OFL fonts this package embeds. Run once; the files are committed.
# Both are variable fonts (wdth, wght); the renderer reads the default width and sets wght.
set -e
cd "$(dirname "$0")"
B=https://raw.githubusercontent.com/google/fonts/main/ofl
curl -sLo NotoSansKannada.ttf "$B/notosanskannada/NotoSansKannada%5Bwdth%2Cwght%5D.ttf"
curl -sLo NotoSans.ttf "$B/notosans/NotoSans%5Bwdth%2Cwght%5D.ttf"
curl -sLo OFL-NotoSansKannada.txt "$B/notosanskannada/OFL.txt"
curl -sLo OFL-NotoSans.txt "$B/notosans/OFL.txt"
