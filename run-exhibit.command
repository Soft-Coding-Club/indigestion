#!/bin/bash
# 소화불량 — 전시 실행 (더블클릭). 전체화면 키오스크, 무한 실행, 크래시 자동복구.
cd "$(dirname "$0")"

# Node 경로 확보 (GUI 더블클릭은 PATH가 좁다)
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "Node가 없습니다" message "먼저 nodejs.org에서 LTS를 설치하세요."'
  exit 1
fi
if [ ! -f .env ]; then
  osascript -e 'display alert "API 키가 없습니다" message ".env 파일에 DEEPINFRA_API_KEY=... 를 넣으세요."'
  exit 1
fi

# 잠자기/화면보호기 억제하며 실행 (전시 8시간 무인)
export KIOSK=1
export PW_CHANNEL=chrome   # 시스템 구글 크롬 사용 (Ventura는 번들 크로미움 미지원)
exec caffeinate -dimsu npx tsx src/spike3-compositor.ts
