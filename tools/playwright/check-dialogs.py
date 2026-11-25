"""回归检查：首页「设置」面板 + 对局内「暂停 / 设置」对话框。

历史问题：改名漏改 `z(...)` 调用（DOM 工厂），点设置/暂停抛 ReferenceError。
本脚本断言：两个对话框都能打开、页面无 pageerror。

用法：
    python tools/playwright/check-dialogs.py
前置：8899 静态服务在线（python3 -m http.server 8899 --bind 127.0.0.1 --directory dist）
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8899/index.html"
errs = []
fail = []


def check(cond, msg):
    print(("✅ " if cond else "❌ ") + msg)
    if not cond:
        fail.append(msg)


with sync_playwright() as p:
    b = p.chromium.launch(headless=False, channel="chrome", slow_mo=100,
                          args=["--no-sandbox", "--window-size=1440,900"])
    pg = b.new_context(viewport={"width": 1440, "height": 900}).new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.goto(URL, wait_until="load", timeout=60000)
    pg.wait_for_timeout(3500)

    # 1) 首页设置
    pg.click("text=设置", timeout=8000)
    pg.wait_for_timeout(1500)
    txt = pg.evaluate("document.body.innerText")
    check("恢复默认" in txt and "主音量" in txt, "首页「设置」面板打开且内容完整")
    pg.screenshot(path="/tmp/reg-settings.png")
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(600)

    # 2) 进入对局
    pg.click("text=开始对战")
    pg.wait_for_timeout(2000)
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(9000)
    check("00:" in pg.evaluate("document.body.innerText"), "进入对局（出现计时）")

    # 3) 暂停 / 设置
    pg.click("[aria-label*='暂停']", timeout=6000)
    pg.wait_for_timeout(1500)
    txt2 = pg.evaluate("document.body.innerText")
    check("游戏暂停" in txt2 and "继续游戏" in txt2, "对局内「暂停」对话框打开且内容完整")
    pg.screenshot(path="/tmp/reg-pause.png")

    # 4) 继续游戏
    pg.click("text=继续游戏", timeout=5000)
    pg.wait_for_timeout(1200)
    check("游戏暂停" not in pg.evaluate("document.body.innerText"), "点「继续游戏」可关闭对话框")

    b.close()

check(not errs, f"全程无 pageerror（实际 {len(errs)} 条）")
for e in errs[:5]:
    print("   " + e)

print("\n回归结果:", "全部通过" if not fail else f"{len(fail)} 项失败")
sys.exit(0 if not fail else 1)
