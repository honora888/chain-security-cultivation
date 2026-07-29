from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps, ImageStat


ROOT = Path(__file__).resolve().parents[1]
PHASE4 = ROOT / "design-sources/quest-1/backgrounds-v1/phase4"
RAW = PHASE4 / "raw"
MASTERS = PHASE4 / "masters"
REVIEW = PHASE4 / "review"
PREVIEWS = PHASE4 / "previews"
PRODUCTION = ROOT / "web/public/assets/quest-1/ui/backgrounds"
PHASE3_MASTERS = ROOT / "design-sources/quest-1/backgrounds-v1/phase3/masters"
AUDIT = ROOT / "design-sources/quest-1/reference-ui-repair-audit"
BEAST = ROOT / "web/public/assets/quest-1/beast"

DESKTOP = (1920, 1200)
MOBILE = (750, 1200)
WEBP_QUALITY = 88

ACTS: dict[str, dict[str, Any]] = {
    "act1": {
        "title": "ACT1 · 妖气苏醒前",
        "subtitle": "平静表面下的微弱异变 · 入场前夜",
        "raw_desktop": "act1-desktop-generated.png",
        "raw_mobile": "act1-mobile-generated.png",
        "source_page": "open-scene-act1-full.png",
        "prompt_summary": "清晨薄雾、弱冷青异光、克制宗门灯火，给妖兽苏醒留出呼吸空间。",
    },
    "act3": {
        "title": "ACT3 · 水灵鉴阵",
        "subtitle": "阵法显形 · 冷静识别漏洞属性",
        "raw_desktop": "act3-desktop-generated.png",
        "raw_mobile": "act3-mobile-generated.png",
        "source_page": "open-scene-act3-full.png",
        "prompt_summary": "右侧水台形成鉴阵承托，冷青水脉与玉石刻线响应，左侧题面区域保持安静。",
    },
    "act6": {
        "title": "ACT6 · 云开功成",
        "subtitle": "宗门复明 · 本地修行结算",
        "raw_desktop": "act6-desktop-generated.png",
        "raw_mobile": "act6-mobile-generated.png",
        "source_page": "open-scene-act6-full.png",
        "prompt_summary": "云开雾散、宗门灯火温润、水台恢复秩序，以克制金青高光完成收束。",
    },
}


def ensure_dirs() -> None:
    for path in (RAW, MASTERS, REVIEW, PREVIEWS, PRODUCTION):
        path.mkdir(parents=True, exist_ok=True)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        ["C:/Windows/Fonts/msyhbd.ttc", "C:/Windows/Fonts/simhei.ttf"]
        if bold
        else ["C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/simsun.ttc"]
    )
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(image.convert("RGB"), size, method=Image.Resampling.LANCZOS)


def contain(image: Image.Image, size: tuple[int, int], color=(245, 243, 234)) -> Image.Image:
    result = Image.new("RGB", size, color)
    item = ImageOps.contain(image.convert("RGB"), size, method=Image.Resampling.LANCZOS)
    result.paste(item, ((size[0] - item.width) // 2, (size[1] - item.height) // 2))
    return result


def stats(path: Path) -> dict[str, float]:
    image = Image.open(path).convert("RGB").resize((320, 200), Image.Resampling.LANCZOS)
    gray = image.convert("L")
    hsv = image.convert("HSV")
    gray_stat = ImageStat.Stat(gray)
    sat_stat = ImageStat.Stat(hsv.getchannel("S"))
    return {
        "mean_luminance": round(gray_stat.mean[0], 2),
        "luminance_stddev": round(gray_stat.stddev[0], 2),
        "mean_saturation": round(sat_stat.mean[0], 2),
    }


def palette(path: Path, count: int = 5) -> list[tuple[int, int, int]]:
    image = Image.open(path).convert("RGB").resize((160, 100), Image.Resampling.LANCZOS)
    quantized = image.quantize(colors=count, method=Image.Quantize.MEDIANCUT)
    values = quantized.getpalette() or []
    colors = quantized.getcolors() or []
    colors.sort(reverse=True)
    output: list[tuple[int, int, int]] = []
    for _, index in colors[:count]:
        output.append(tuple(values[index * 3 : index * 3 + 3]))
    return output


def save_master_and_webp(act: str) -> tuple[Path, Path, Path, Path]:
    spec = ACTS[act]
    desktop_raw = RAW / spec["raw_desktop"]
    mobile_raw = RAW / spec["raw_mobile"]
    if not desktop_raw.exists() or not mobile_raw.exists():
        raise FileNotFoundError(f"Missing raw images for {act}: {desktop_raw}, {mobile_raw}")

    desktop_master = MASTERS / f"quest-1-{act}-background-desktop-master.png"
    mobile_master = MASTERS / f"quest-1-{act}-background-mobile-master.png"
    desktop_webp = PRODUCTION / f"quest-1-{act}-background-desktop.webp"
    mobile_webp = PRODUCTION / f"quest-1-{act}-background-mobile.webp"

    with Image.open(desktop_raw) as image:
        result = cover(image, DESKTOP)
        result.save(desktop_master, optimize=True)
        result.save(desktop_webp, "WEBP", quality=WEBP_QUALITY, method=6)
    with Image.open(mobile_raw) as image:
        result = cover(image, MOBILE)
        result.save(mobile_master, optimize=True)
        result.save(mobile_webp, "WEBP", quality=WEBP_QUALITY, method=6)
    return desktop_master, mobile_master, desktop_webp, mobile_webp


def draw_safe_zones(image: Image.Image, act: str, mobile: bool = False) -> Image.Image:
    canvas = image.convert("RGBA")
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    w, h = canvas.size
    zones: list[tuple[str, tuple[int, int, int, int], tuple[int, int, int, int]]]
    if mobile:
        zones = [
            ("标题", (0, 0, w, int(h * 0.17)), (44, 120, 129, 62)),
            ("主内容", (int(w * 0.07), int(h * 0.18), int(w * 0.93), int(h * 0.78)), (218, 179, 88, 48)),
            ("人物栏", (0, int(h * 0.82), w, h), (115, 89, 138, 58)),
        ]
    elif act == "act1":
        zones = [
            ("标题", (0, 0, w, int(h * 0.17)), (44, 120, 129, 62)),
            ("妖兽入场", (int(w * 0.28), int(h * 0.2), int(w * 0.78), int(h * 0.78)), (218, 179, 88, 52)),
            ("人物栏", (0, int(h * 0.82), w, h), (115, 89, 138, 58)),
        ]
    elif act == "act3":
        zones = [
            ("标题", (0, 0, w, int(h * 0.17)), (44, 120, 129, 62)),
            ("分类题卡", (int(w * 0.03), int(h * 0.23), int(w * 0.54), int(h * 0.76)), (218, 179, 88, 50)),
            ("水阵组件", (int(w * 0.55), int(h * 0.2), int(w * 0.96), int(h * 0.78)), (58, 150, 168, 55)),
            ("人物栏", (0, int(h * 0.82), w, h), (115, 89, 138, 58)),
        ]
    else:
        zones = [
            ("标题", (0, 0, w, int(h * 0.17)), (44, 120, 129, 62)),
            ("奖励结算", (int(w * 0.07), int(h * 0.2), int(w * 0.93), int(h * 0.78)), (218, 179, 88, 48)),
            ("人物栏", (0, int(h * 0.82), w, h), (115, 89, 138, 58)),
        ]
    for label, box, color in zones:
        draw.rectangle(box, fill=color, outline=color[:3] + (190,), width=max(2, w // 600))
        draw.text((box[0] + 12, box[1] + 10), label, font=font(max(18, w // 70), True), fill=(20, 62, 69, 230))
    return Image.alpha_composite(canvas, overlay).convert("RGB")


def build_act_review(act: str) -> Path:
    spec = ACTS[act]
    desktop = MASTERS / f"quest-1-{act}-background-desktop-master.png"
    mobile = MASTERS / f"quest-1-{act}-background-mobile-master.png"
    board = Image.new("RGB", (2400, 1780), (246, 243, 233))
    draw = ImageDraw.Draw(board)
    draw.text((70, 48), f"Phase 4 · {spec['title']}", font=font(48, True), fill=(19, 62, 69))
    draw.text((70, 112), spec["subtitle"], font=font(25), fill=(82, 112, 114))

    with Image.open(desktop) as image:
        desktop_preview = contain(image, (1460, 912))
        safe_preview = contain(draw_safe_zones(image, act), (700, 438))
    with Image.open(mobile) as image:
        mobile_preview = contain(image, (520, 832))
        mobile_safe = contain(draw_safe_zones(image, act, True), (350, 560))

    board.paste(desktop_preview, (70, 180))
    board.paste(mobile_preview, (1550, 180))
    board.paste(safe_preview, (70, 1140))
    board.paste(mobile_safe, (800, 1140))
    draw.text((1180, 1170), "设计意图", font=font(30, True), fill=(19, 62, 69))
    draw.multiline_text(
        (1180, 1220),
        spec["prompt_summary"],
        font=font(23),
        fill=(43, 77, 81),
        spacing=12,
    )
    desktop_stats = stats(desktop)
    mobile_stats = stats(mobile)
    draw.text((1180, 1340), f"Desktop  {desktop_stats}", font=font(20), fill=(64, 91, 93))
    draw.text((1180, 1380), f"Mobile   {mobile_stats}", font=font(20), fill=(64, 91, 93))
    colors = palette(desktop)
    for index, color in enumerate(colors):
        draw.rectangle((1180 + index * 180, 1460, 1345 + index * 180, 1535), fill=color)
        draw.text((1180 + index * 180, 1545), "#%02X%02X%02X" % color, font=font(17), fill=(43, 66, 68))
    draw.text((70, 1695), "审查重点：世界锚点连续 · 内容安全区 · 无 UI/文字/人物/妖兽 · 移动端独立构图", font=font(22), fill=(82, 104, 105))
    output = REVIEW / f"phase4-{act}-background-review.png"
    board.save(output, optimize=True)
    return output


def paste_soft(canvas: Image.Image, source: Image.Image, box: tuple[int, int, int, int], opacity: int = 238) -> None:
    width = box[2] - box[0]
    height = box[3] - box[1]
    item = contain(source, (width, height), (255, 255, 255)).convert("RGBA")
    item.putalpha(opacity)
    canvas.alpha_composite(item, (box[0], box[1]))


def page_preview(act: str) -> Path:
    background_path = MASTERS / f"quest-1-{act}-background-desktop-master.png"
    with Image.open(background_path) as image:
        canvas = cover(image, (1440, 1024)).convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    # Local translucency only: HUD, title plaque, and mentor panel.
    draw.rounded_rectangle((48, 18, 1392, 126), radius=20, fill=(247, 250, 243, 226), outline=(112, 165, 164, 185), width=2)
    draw.text((78, 45), "Quest 1 · 噬灵回环兽", font=font(26, True), fill=(19, 61, 68))
    draw.text((650, 42), "Boss HP", font=font(18), fill=(47, 77, 80))
    hp = {"act1": 100, "act3": 75, "act6": 0}[act]
    draw.rounded_rectangle((650, 74, 1095, 88), radius=7, fill=(214, 225, 213, 255))
    draw.rounded_rectangle((650, 74, 650 + int(445 * hp / 100), 88), radius=7, fill=(39, 128, 137, 255))
    draw.text((1110, 64), f"{hp}%", font=font(18, True), fill=(19, 61, 68))

    title_text = {"act1": "噬灵回环兽现身", "act3": "识破妖法", "act6": "战利品与升级"}[act]
    draw.rounded_rectangle((480, 148, 960, 245), radius=18, fill=(250, 249, 239, 226), outline=(161, 184, 166, 180), width=2)
    text_box = draw.textbbox((0, 0), title_text, font=font(39, True))
    draw.text(((1440 - (text_box[2] - text_box[0])) // 2, 174), title_text, font=font(39, True), fill=(16, 55, 61))

    if act == "act1":
        with Image.open(BEAST / "reentry-devourer-dormant-2.webp") as beast:
            item = ImageOps.contain(beast.convert("RGBA"), (650, 570), Image.Resampling.LANCZOS)
            canvas.alpha_composite(item, ((1440 - item.width) // 2, 255))
        draw.text((555, 790), "静态合成预览 · 妖兽苏醒区域", font=font(20), fill=(30, 74, 79))
    elif act == "act3":
        draw.rounded_rectangle((70, 315, 745, 720), radius=22, fill=(250, 251, 244, 220), outline=(116, 167, 165, 170), width=2)
        headings = [("漏洞类型", ["经典重入漏洞", "访问控制漏洞", "整数溢出漏洞"]), ("五行属性", ["水", "火", "金"]), ("风险等级", ["High", "Medium", "Low"])]
        x = 95
        for heading, options in headings:
            draw.text((x, 345), heading, font=font(22, True), fill=(20, 59, 64))
            for row, option in enumerate(options):
                y = 395 + row * 82
                draw.rounded_rectangle((x, y, x + 185, y + 58), radius=12, fill=(255, 255, 250, 232), outline=(147, 183, 177, 170), width=2)
                draw.ellipse((x + 14, y + 19, x + 32, y + 37), outline=(75, 116, 116), width=2)
                draw.text((x + 43, y + 15), option, font=font(17), fill=(34, 65, 68))
            x += 215
        # Abstractly reserve the real WaterFormationSigil footprint without baking the UI asset into the background.
        sigil = Image.new("RGBA", (420, 420), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sigil)
        for radius, width, alpha in ((180, 12, 210), (145, 5, 185), (105, 4, 165)):
            sd.ellipse((210 - radius, 210 - radius, 210 + radius, 210 + radius), outline=(28, 117, 129, alpha), width=width)
        sd.rounded_rectangle((165, 165, 255, 255), radius=10, fill=(217, 240, 233, 220), outline=(27, 103, 114, 235), width=8)
        sd.text((187, 181), "水", font=font(46, True), fill=(23, 102, 113, 235))
        canvas.alpha_composite(sigil, (885, 300))
        draw.text((1015, 730), "水灵鉴阵组件区域", font=font(20), fill=(30, 74, 79))
    else:
        with Image.open(BEAST / "reentry-devourer-defeated-v1.webp") as beast:
            item = ImageOps.contain(beast.convert("RGBA"), (410, 390), Image.Resampling.LANCZOS)
            canvas.alpha_composite(item, (105, 310))
        draw.rounded_rectangle((555, 320, 1320, 700), radius=24, fill=(250, 250, 242, 220), outline=(155, 176, 157, 180), width=2)
        draw.text((625, 370), "本地学习结算", font=font(42, True), fill=(19, 57, 61))
        rewards = [("EXP", "+120"), ("重入防御熟练度", "+18"), ("水系守护者徽记", "已解锁")]
        y = 460
        for label, value in rewards:
            draw.rounded_rectangle((620, y, 1250, y + 62), radius=14, fill=(255, 255, 248, 225), outline=(135, 173, 161, 160), width=2)
            draw.text((645, y + 17), label, font=font(20, True), fill=(26, 72, 76))
            draw.text((1100, y + 17), value, font=font(20, True), fill=(42, 122, 115))
            y += 78

    draw.rounded_rectangle((50, 830, 1390, 994), radius=26, fill=(249, 247, 235, 242), outline=(81, 139, 139, 220), width=2)
    draw.ellipse((78, 855, 190, 967), fill=(219, 231, 220, 255), outline=(86, 133, 132, 200), width=2)
    draw.text((220, 858), "守阵长老", font=font(28, True), fill=(18, 62, 68))
    guidance = {
        "act1": "回环妖气已现，先看清它吞噬灵脉的方式。",
        "act3": "认清妖法，水阵才会回应。",
        "act6": "妖兽已封，技术修复与链上凭证仍须分别核验。",
    }[act]
    draw.text((220, 905), guidance, font=font(21), fill=(50, 87, 90))
    draw.rounded_rectangle((1130, 872, 1340, 948), radius=16, fill=(31, 132, 142, 255), outline=(220, 225, 190, 255), width=2)
    draw.text((1183, 891), "主操作", font=font(24, True), fill=(255, 253, 238))
    draw.rounded_rectangle((18, 18, 326, 58), radius=10, fill=(16, 62, 68, 245))
    draw.text((34, 26), "静态合成预览 · 非生产资产", font=font(18, True), fill=(248, 245, 229))
    output = PREVIEWS / f"phase4-{act}-page-composite.png"
    canvas.convert("RGB").save(output, optimize=True)
    return output


def mobile_preview(act: str) -> Image.Image:
    background = MASTERS / f"quest-1-{act}-background-mobile-master.png"
    with Image.open(background) as image:
        canvas = cover(image, (390, 844)).convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((12, 12, 378, 98), radius=14, fill=(248, 250, 243, 231), outline=(103, 154, 154, 190), width=2)
    draw.text((25, 28), f"Quest 1 · {ACTS[act]['title'].split('·')[-1].strip()}", font=font(18, True), fill=(18, 60, 66))
    draw.text((25, 61), "移动端独立背景合成", font=font(14), fill=(55, 85, 87))
    title = {"act1": "妖兽现身", "act3": "识破妖法", "act6": "战利品与升级"}[act]
    draw.rounded_rectangle((76, 115, 314, 175), radius=14, fill=(250, 249, 239, 229), outline=(154, 182, 166, 180), width=2)
    bbox = draw.textbbox((0, 0), title, font=font(25, True))
    draw.text(((390 - (bbox[2] - bbox[0])) // 2, 129), title, font=font(25, True), fill=(15, 55, 61))
    if act == "act1":
        with Image.open(BEAST / "reentry-devourer-dormant-2.webp") as beast:
            item = ImageOps.contain(beast.convert("RGBA"), (330, 350), Image.Resampling.LANCZOS)
            canvas.alpha_composite(item, ((390 - item.width) // 2, 205))
    elif act == "act3":
        draw.rounded_rectangle((24, 205, 366, 505), radius=18, fill=(249, 251, 245, 222), outline=(112, 159, 157, 180), width=2)
        for row, label in enumerate(("漏洞类型", "五行属性", "风险等级")):
            y = 230 + row * 84
            draw.text((42, y), label, font=font(18, True), fill=(22, 62, 66))
            draw.rounded_rectangle((42, y + 32, 348, y + 72), radius=10, fill=(255, 255, 249, 235), outline=(145, 179, 174, 170), width=2)
        draw.ellipse((117, 520, 273, 676), outline=(27, 112, 124, 230), width=8)
        draw.rectangle((163, 566, 227, 630), outline=(27, 112, 124, 230), width=6)
    else:
        with Image.open(BEAST / "reentry-devourer-defeated-v1.webp") as beast:
            item = ImageOps.contain(beast.convert("RGBA"), (240, 220), Image.Resampling.LANCZOS)
            canvas.alpha_composite(item, ((390 - item.width) // 2, 190))
        draw.rounded_rectangle((24, 410, 366, 675), radius=18, fill=(250, 250, 243, 224), outline=(142, 171, 159, 180), width=2)
        draw.text((67, 445), "本地学习结算", font=font(28, True), fill=(18, 59, 63))
        for row, label in enumerate(("EXP +120", "熟练度 +18", "水系守护者徽记")):
            draw.text((56, 505 + row * 48), label, font=font(18), fill=(30, 78, 80))
    draw.rounded_rectangle((12, 700, 378, 832), radius=20, fill=(248, 246, 234, 242), outline=(79, 135, 135, 210), width=2)
    draw.text((28, 718), "守阵长老", font=font(20, True), fill=(18, 62, 68))
    draw.text((28, 754), "当前目标与操作保持可读。", font=font(16), fill=(52, 84, 86))
    draw.rounded_rectangle((238, 770, 354, 818), radius=12, fill=(31, 132, 142, 255))
    draw.text((264, 782), "继续", font=font(18, True), fill=(255, 253, 238))
    return canvas.convert("RGB")


def build_contact_sheets() -> None:
    desktop_board = Image.new("RGB", (2400, 980), (246, 243, 233))
    mobile_board = Image.new("RGB", (1740, 1450), (246, 243, 233))
    dd = ImageDraw.Draw(desktop_board)
    md = ImageDraw.Draw(mobile_board)
    dd.text((60, 38), "Phase 4 Desktop Backgrounds · ACT1 / ACT3 / ACT6", font=font(42, True), fill=(18, 61, 67))
    md.text((55, 36), "Phase 4 Mobile Backgrounds · Independent Compositions", font=font(38, True), fill=(18, 61, 67))
    for index, act in enumerate(("act1", "act3", "act6")):
        with Image.open(MASTERS / f"quest-1-{act}-background-desktop-master.png") as image:
            preview = contain(image, (720, 450))
        x = 60 + index * 780
        desktop_board.paste(preview, (x, 125))
        dd.text((x, 600), ACTS[act]["title"], font=font(29, True), fill=(18, 61, 67))
        dd.text((x, 646), ACTS[act]["subtitle"], font=font(19), fill=(79, 105, 106))
        colors = palette(MASTERS / f"quest-1-{act}-background-desktop-master.png")
        for color_index, color in enumerate(colors):
            dd.rectangle((x + color_index * 140, 710, x + 130 + color_index * 140, 785), fill=color)
        with Image.open(MASTERS / f"quest-1-{act}-background-mobile-master.png") as image:
            mobile = contain(image, (500, 800))
        mx = 55 + index * 560
        mobile_board.paste(mobile, (mx, 120))
        md.text((mx, 950), ACTS[act]["title"], font=font(27, True), fill=(18, 61, 67))
        md.multiline_text((mx, 998), ACTS[act]["subtitle"], font=font(18), fill=(79, 105, 106), spacing=8)
    desktop_board.save(REVIEW / "phase4-desktop-contact-sheet.png", optimize=True)
    mobile_board.save(REVIEW / "phase4-mobile-contact-sheet.png", optimize=True)


def build_color_progression() -> None:
    all_paths = {
        "act1": MASTERS / "quest-1-act1-background-desktop-master.png",
        "act2": PHASE3_MASTERS / "quest-1-act2-background-desktop-master.png",
        "act3": MASTERS / "quest-1-act3-background-desktop-master.png",
        "act4": PHASE3_MASTERS / "quest-1-act4-background-desktop-master.png",
        "act5": PHASE3_MASTERS / "quest-1-act5-background-desktop-master.png",
        "act6": MASTERS / "quest-1-act6-background-desktop-master.png",
    }
    board = Image.new("RGB", (2400, 1260), (246, 243, 233))
    draw = ImageDraw.Draw(board)
    draw.text((60, 42), "Quest 1 · Six-Act Color Progression", font=font(44, True), fill=(18, 61, 67))
    for index, (act, path) in enumerate(all_paths.items()):
        row, column = divmod(index, 3)
        with Image.open(path) as image:
            preview = contain(image, (720, 450))
        x = 60 + column * 780
        y = 125 + row * 555
        board.paste(preview, (x, y))
        draw.text((x, y + 465), act.upper(), font=font(28, True), fill=(18, 61, 67))
        data = stats(path)
        draw.text((x + 100, y + 470), f"L {data['mean_luminance']} · S {data['mean_saturation']}", font=font(18), fill=(79, 105, 106))
    board.save(REVIEW / "phase4-color-progression.png", optimize=True)


def build_safe_zone_guide() -> None:
    board = Image.new("RGB", (2400, 1040), (246, 243, 233))
    draw = ImageDraw.Draw(board)
    draw.text((60, 38), "Phase 4 · Content Safe-Zone Guide", font=font(42, True), fill=(18, 61, 67))
    for index, act in enumerate(("act1", "act3", "act6")):
        with Image.open(MASTERS / f"quest-1-{act}-background-desktop-master.png") as image:
            preview = contain(draw_safe_zones(image, act), (720, 450))
        x = 60 + index * 780
        board.paste(preview, (x, 120))
        draw.text((x, 592), ACTS[act]["title"], font=font(27, True), fill=(18, 61, 67))
        with Image.open(MASTERS / f"quest-1-{act}-background-mobile-master.png") as image:
            mobile = contain(draw_safe_zones(image, act, True), (250, 400))
        board.paste(mobile, (x + 235, 645))
    board.save(REVIEW / "phase4-safe-zone-guide.png", optimize=True)


def build_mobile_composite_sheet() -> None:
    board = Image.new("RGB", (1290, 980), (246, 243, 233))
    draw = ImageDraw.Draw(board)
    draw.text((55, 34), "Phase 4 · Mobile Static Page Composites · 390 × 844", font=font(38, True), fill=(18, 61, 67))
    for index, act in enumerate(("act1", "act3", "act6")):
        preview = mobile_preview(act)
        x = 35 + index * 420
        board.paste(preview, (x, 105))
        draw.text((x + 8, 936), act.upper(), font=font(24, True), fill=(18, 61, 67))
    board.save(PREVIEWS / "phase4-mobile-page-composite-contact-sheet.png", optimize=True)


def file_record(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        alpha = "opaque"
        if image.mode in ("RGBA", "LA"):
            extrema = image.getchannel("A").getextrema()
            alpha = "opaque" if extrema == (255, 255) else f"alpha-range:{extrema[0]}-{extrema[1]}"
        return {
            "path": path.relative_to(ROOT).as_posix(),
            "dimensions": [image.width, image.height],
            "format": image.format,
            "mode": image.mode,
            "alpha": alpha,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "statistics": stats(path),
        }


def build_manifest() -> Path:
    assets: dict[str, Any] = {}
    for act in ("act1", "act3", "act6"):
        assets[act] = {
            "design_intent": ACTS[act]["prompt_summary"],
            "desktop_master": file_record(MASTERS / f"quest-1-{act}-background-desktop-master.png"),
            "desktop_production": file_record(PRODUCTION / f"quest-1-{act}-background-desktop.webp"),
            "mobile_master": file_record(MASTERS / f"quest-1-{act}-background-mobile-master.png"),
            "mobile_production": file_record(PRODUCTION / f"quest-1-{act}-background-mobile.webp"),
            "review": str((REVIEW / f"phase4-{act}-background-review.png").relative_to(ROOT).as_posix()),
            "page_composite": str((PREVIEWS / f"phase4-{act}-page-composite.png").relative_to(ROOT).as_posix()),
        }
    manifest = {
        "title": "Quest 1 Backgrounds Phase 4",
        "version": 1,
        "production_scope": ["ACT1", "ACT3", "ACT6"],
        "generation_mode": "OpenAI built-in image generation with locked local master references",
        "webp_quality": WEBP_QUALITY,
        "desktop_size": list(DESKTOP),
        "mobile_size": list(MOBILE),
        "front_end_integration": False,
        "phase3_assets_modified": False,
        "generation_prompts": "design-sources/quest-1/backgrounds-v1/phase4/review/phase4-generation-prompts.md",
        "assets": assets,
        "review_assets": [
            str(path.relative_to(ROOT).as_posix())
            for path in sorted(REVIEW.glob("phase4-*"))
            if path.name != "phase4-manifest.json"
        ],
        "preview_assets": [
            str(path.relative_to(ROOT).as_posix()) for path in sorted(PREVIEWS.glob("phase4-*"))
        ],
    }
    output = REVIEW / "phase4-manifest.json"
    output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output


def process_act(act: str) -> None:
    ensure_dirs()
    save_master_and_webp(act)
    build_act_review(act)


def process_all() -> None:
    for act in ("act1", "act3", "act6"):
        process_act(act)
        page_preview(act)
    build_contact_sheets()
    build_color_progression()
    build_safe_zone_guide()
    build_mobile_composite_sheet()
    build_manifest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--act", choices=tuple(ACTS), help="Process one act and its review")
    parser.add_argument("--all", action="store_true", help="Build all Phase 4 assets and review boards")
    args = parser.parse_args()
    if args.all:
        process_all()
    elif args.act:
        process_act(args.act)
    else:
        parser.error("Use --act ACT or --all")


if __name__ == "__main__":
    main()
