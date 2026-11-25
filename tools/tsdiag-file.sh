#!/bin/bash
# 在隔离沙箱中验证「指定文件去帽后」的 tsc 错误。
# 用法: bash tools/tsdiag-file.sh <源文件相对路径> [更多文件...]
# 复制工作区 src 到临时沙箱，移除指定文件的 @ts-nocheck，跑 tsc，
# 输出这些文件的错误数与明细。不改动工作区源码。
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SB="/tmp/tsdiag-sb-$$"
trap 'rm -rf "$SB"' EXIT
mkdir -p "$SB"
cp -R "$ROOT/src" "$SB/src"
cp "$ROOT/tsconfig.json" "$SB/"
ln -s "$ROOT/node_modules" "$SB/node_modules"
python3 - "$SB" "$@" <<'PY'
import os, re, sys
sb = sys.argv[1]
targets = [t.replace('\\','/') for t in sys.argv[2:]]
removed = []
for rel in targets:
    p = os.path.join(sb, 'src', rel)
    if not os.path.exists(p):
        print('MISSING:', rel); continue
    s = open(p).read()
    s2 = re.sub(r'^\s*//\s*@ts-nocheck.*\n', '', s, flags=re.M)
    if s2 != s:
        open(p,'w').write(s2); removed.append(rel)
print('removed nocheck:', len(removed), removed)
PY
cd "$SB"
"$ROOT/node_modules/.bin/tsc" --noEmit --pretty false > "$SB/err.txt" 2>&1 || true
python3 - "$SB" "$@" <<'PY'
import os,re,sys
sb=sys.argv[1]; targets=set(t.replace('\\','/') for t in sys.argv[2:])
lines=[l for l in open(os.path.join(sb,'err.txt')) if re.search(r'error TS\d+:',l)]
def norm(p):
    p = p.replace(sb+'/','').replace(sb,'')
    # tsc 输出形如 src/kernel/xxx.ts(line,col):
    if p.startswith('src/'): p = p[4:]
    return p
mine=[l for l in lines if any(norm(l).startswith(t+'(') for t in targets)]
print('TARGET_ERRORS',len(mine))
for l in mine[:400]: print(l.rstrip())
PY
