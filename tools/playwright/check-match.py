"""有界面（headed）Playwright：进入对局，验证战场 3D 渲染与 HUD。"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

# 默认调试版 8899；验证发布版可设 STARFALL_URL=http://127.0.0.1:8898/index.html
URL = os.environ.get("STARFALL_URL", "http://127.0.0.1:8899/index.html")
OUT = "/tmp"
logs, errors = [], []


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            channel="chrome",
            slow_mo=200,
            args=["--no-sandbox", "--window-size=1440,900", "--window-position=80,60"],
        )
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"[:300]))
        page.on("pageerror", lambda e: errors.append(str(e)[:400]))

        page.goto(URL, wait_until="load", timeout=60000)
        page.wait_for_timeout(3500)

        # 菜单 → 选英雄
        page.click("text=开始对战")
        page.wait_for_timeout(2200)
        # 用键盘操作（比文本选择器稳）：Enter 直接用当前英雄开局
        page.wait_for_timeout(800)
        page.screenshot(path=f"{OUT}/10-select.png")
        page.keyboard.press("Enter")
        page.wait_for_timeout(4000)
        page.screenshot(path=f"{OUT}/11-loading.png")
        page.wait_for_timeout(8000)
        page.screenshot(path=f"{OUT}/12-match-start.png")
        page.wait_for_timeout(12000)
        page.screenshot(path=f"{OUT}/13-match-12s.png")

        info = page.evaluate(
            """() => ({
              canvas: (() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null })(),
              text: (document.body.innerText || '').slice(0, 400),
            })"""
        )
        browser.close()
        return info


try:
    info = main()
    print(json.dumps({"ok": True, "info": info}, ensure_ascii=False, indent=1))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)[:500]}, ensure_ascii=False))
    sys.exit(1)

print("--- console(最后 15) ---")
for l in logs[-15:]:
    print(l)
print("--- pageerror ---")
for e in errors[-10:]:
    print(e)
