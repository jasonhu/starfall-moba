"""对局内操作测试：跳过引导 → WASD 移动 → Q 冲锋，验证技能真的执行。"""
import json
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8899/index.html"
OUT = "/tmp"
logs, errors = [], []


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            channel="chrome",
            slow_mo=120,
            args=["--no-sandbox", "--window-size=1440,900", "--window-position=80,60"],
        )
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"[:200]))
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))

        page.goto(URL, wait_until="load", timeout=60000)
        page.wait_for_timeout(3000)
        page.click("text=开始对战")
        page.wait_for_timeout(1800)
        page.click("text=项羽")
        page.wait_for_timeout(1000)
        page.click("button:has-text('开始对战')")
        page.wait_for_timeout(9000)

        # 跳过引导
        try:
            page.click("text=跳过引导")
            page.wait_for_timeout(800)
        except Exception:
            pass

        # 记录初始位置（从 HUD/世界取不到，用截图对比）
        page.screenshot(path=f"{OUT}/20-before-move.png")

        # WASD 前进 1.2 秒
        page.keyboard.down("w")
        page.wait_for_timeout(1200)
        page.keyboard.up("w")
        page.wait_for_timeout(500)
        page.screenshot(path=f"{OUT}/21-after-w.png")

        # Q 冲锋：鼠标指向右上，按住 Q 再松开
        page.mouse.move(1000, 380)
        page.wait_for_timeout(300)
        page.keyboard.down("q")
        page.wait_for_timeout(700)          # 按住期间应出现方向指示
        page.screenshot(path=f"{OUT}/22-q-aiming.png")
        page.keyboard.up("q")
        page.wait_for_timeout(120)
        page.screenshot(path=f"{OUT}/23-q-dash.png")
        page.wait_for_timeout(900)
        page.screenshot(path=f"{OUT}/24-q-after.png")

        # 技能是否进入 CD（读 HUD 文本里的冷确提示）
        info = page.evaluate(
            """() => {
              const t = document.body.innerText || ''
              return { hasCd: /\\d+(\\.\\d+)?s/.test(t), text: t.slice(0, 260) }
            }"""
        )
        browser.close()
        return info


try:
    info = main()
    print(json.dumps({"ok": True, "info": info}, ensure_ascii=False, indent=1))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)[:400]}, ensure_ascii=False))
    sys.exit(1)

print("--- console(最后 12) ---")
for l in logs[-12:]:
    print(l)
print("--- pageerror ---")
for e in errors[-8:]:
    print(e)
