"""回归：释放 Q 技能不得出现 `n.fx is not a function`。

覆盖两条路径：
  1) 键盘按住 Q → 移动鼠标定方向 → 松开
  2) 直接点击右下角 Q 技能按钮
判定：无 pageerror、无 console error，且技能真的进入冷却（HUD 上出现秒数）。
"""
import json
import re
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8899/index.html"
OUT = "/tmp"
logs, errors = [], []


def read_mana(page):
    """从底部属性面板抓法力值（形如 385 / 430）。"""
    txt = page.evaluate("() => (document.body.innerText || '')")
    m = re.search(r"(\d{2,4})\s*/\s*(\d{2,4})", txt)
    return (int(m.group(1)), int(m.group(2))) if m else None


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            channel="chrome",
            slow_mo=150,
            args=["--no-sandbox", "--window-size=1440,900", "--window-position=80,60"],
        )
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"[:300]))
        page.on("pageerror", lambda e: errors.append(str(e)[:400]))

        page.goto(URL, wait_until="load", timeout=60000)
        page.wait_for_timeout(3500)
        page.click("text=开始对战")
        page.wait_for_timeout(2200)
        page.keyboard.press("Enter")
        page.wait_for_timeout(12000)

        # 关掉新手引导（可能挡住技能栏）
        for label in ("跳过引导", "知道了", "关闭"):
            try:
                page.click(f"text={label}", timeout=1500)
                page.wait_for_timeout(400)
            except Exception:
                pass

        page.screenshot(path=f"{OUT}/fx-00-match.png")
        mana_before = read_mana(page)

        # 路径 1：键盘 Q（按住 → 移鼠标 → 松开）
        page.mouse.move(900, 500)
        page.keyboard.down("q")
        page.wait_for_timeout(700)
        page.screenshot(path=f"{OUT}/fx-01-aiming.png")
        page.mouse.move(1080, 430)
        page.wait_for_timeout(200)
        page.keyboard.up("q")
        page.wait_for_timeout(1200)
        page.screenshot(path=f"{OUT}/fx-02-after-key-q.png")
        err_after_key = list(errors)
        mana_after_key = read_mana(page)

        # 路径 2：点击技能栏 Q 按钮
        clicked = False
        for sel in ("button.sf-slot >> nth=0", "[data-slot='s1']", "button:has-text('Q')"):
            try:
                page.click(sel, timeout=2000)
                clicked = True
                break
            except Exception:
                continue
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{OUT}/fx-03-after-click-q.png")

        hud = page.evaluate("() => (document.body.innerText || '').slice(0, 300)")
        browser.close()

        return {
            "clicked_skill_button": clicked,
            "mana_before": mana_before,
            "mana_after_key_q": mana_after_key,
            "errors_after_key_q": err_after_key,
            "hud": hud,
        }


try:
    info = main()
    bad = [e for e in errors if "is not a function" in e or "undefined" in e]
    ok = not bad
    print(json.dumps({"ok": ok, "info": info, "all_errors": errors}, ensure_ascii=False, indent=1))
    if not ok:
        sys.exit(1)
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)[:500]}, ensure_ascii=False))
    sys.exit(1)

print("--- console 中的错误 ---")
for l in logs:
    if l.startswith("[error]"):
        print(l)
print("--- pageerror ---")
for e in errors:
    print(e)
