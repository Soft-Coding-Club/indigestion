#!/bin/bash
# 소화불량 — 아이맥 최초 설치 (더블클릭). 의존성 + 크로미움 내려받기.
cd "$(dirname "$0")"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

echo "=== 소화불량 설치 ==="
if ! command -v node >/dev/null 2>&1; then
  echo "Node가 없습니다. nodejs.org 에서 LTS(.pkg)를 먼저 설치하세요."
  echo "설치 후 이 파일을 다시 더블클릭하세요."
  read -r -p "엔터를 눌러 닫기..." _
  exit 1
fi
echo "Node: $(node -v)"

echo "--- 의존성 설치 (npm install) ---"
npm install || { echo "npm install 실패"; read -r -p "엔터..." _; exit 1; }

# 브라우저: 번들 크로미움 대신 시스템 구글 크롬을 쓴다 (Ventura는 번들 크로미움 미지원)
if [ ! -d "/Applications/Google Chrome.app" ]; then
  echo ""
  echo "!! 구글 크롬이 없습니다. https://www.google.com/chrome 에서 설치한 뒤"
  echo "   이 창을 닫고 run-exhibit.command 를 실행하세요."
else
  echo "구글 크롬 확인됨."
fi

if [ ! -f .env ]; then
  echo "--- API 키 설정 ---"
  read -r -p "DEEPINFRA_API_KEY 를 붙여넣으세요: " KEY
  echo "DEEPINFRA_API_KEY=$KEY" > .env
  echo ".env 생성 완료."
fi

echo ""
echo "설치 끝. 이제 run-exhibit.command 를 더블클릭하면 전체화면으로 시작합니다."
read -r -p "엔터를 눌러 닫기..." _
