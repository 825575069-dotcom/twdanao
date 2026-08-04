"""
资质文件 OCR 识别服务
提取证书编号、有效期至
"""


import io
import os
import re
from datetime import datetime
from typing import Optional

from django.conf import settings

try:
    from PIL import Image
    HAS_PIL = True
except Exception:
    HAS_PIL = False

try:
    import pytesseract
    HAS_TESSERACT = True
except Exception:
    HAS_TESSERACT = False

try:
    import fitz  # pymupdf
    HAS_PYMUPDF = True
except Exception:
    HAS_PYMUPDF = False


# 日期格式模式
_DATE_PATTERNS = [
    r'(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日',
    r'(\d{4})/(\d{1,2})/(\d{1,2})',
    r'(\d{4})-(\d{1,2})-(\d{1,2})',
    r'(\d{4})\.(\d{1,2})\.(\d{1,2})',
]

# 统一社会信用代码 / 营业执照注册号
# 注意：OCR 可能在代码中间插入空格，用 _strip_spaces 清理后再匹配
_CREDIT_CODE_RE = re.compile(r'[0-9A-HJ-NPQRTUWXY]{18}')
_CREDIT_CODE_LOOSE_RE = re.compile(r'(?:[0-9A-HJ-NPQRTUWXY]\s*){17}[0-9A-HJ-NPQRTUWXY]')
_REG_NO_RE = re.compile(r'\b\d{15}\b')


def _normalize_date(y: str, m: str, d: str) -> Optional[str]:
    try:
        return f'{int(y):04d}-{int(m):02d}-{int(d):02d}'
    except Exception:
        return None


def _extract_dates(text: str) -> list:
    """提取所有日期，返回 YYYY-MM-DD 列表"""
    dates = []
    for pattern in _DATE_PATTERNS:
        for m in re.finditer(pattern, text):
            normalized = _normalize_date(m.group(1), m.group(2), m.group(3))
            if normalized:
                dates.append((normalized, m.start()))
    # 去重并保持顺序
    seen = set()
    result = []
    for d, pos in dates:
        if d not in seen:
            seen.add(d)
            result.append((d, pos))
    return result


def _extract_license_number(text: str, qual_type: str = '') -> Optional[str]:
    """根据资质类型提取证书编号"""
    # 1. 统一社会信用代码（营业执照）—— 精确匹配（无空格）
    m = _CREDIT_CODE_RE.search(text)
    if m:
        return m.group(0)

    # 1b. 宽松匹配：OCR 可能在代码中间插入空格，清理后返回
    m = _CREDIT_CODE_LOOSE_RE.search(text)
    if m:
        return re.sub(r'\s+', '', m.group(0))

    # 1c. 关键词引导的宽松匹配：在「信用代码」等关键词附近找 18 位字母数字
    _kw_loose = re.compile(r'(?:统一社会信用代码|信用代码|注册号)[:：\s]*([0-9A-Za-z\s]{18,30})')
    m = _kw_loose.search(text)
    if m:
        candidate = re.sub(r'\s+', '', m.group(1))
        if len(candidate) >= 18:
            return candidate[:18]

    # 2. 营业执照注册号
    m = _REG_NO_RE.search(text)
    if m:
        return m.group(0)

    # 3. 通用证号/编号模式
    patterns = [
        r'证号[:：]\s*([A-Za-z0-9\-]+)',
        r'证书编号[:：]\s*([A-Za-z0-9\-]+)',
        r'编号[:：]\s*([A-Za-z0-9\-]+)',
        r'许可证号[:：]\s*([A-Za-z0-9\-]+)',
        r'注册证号[:：]\s*([A-Za-z0-9\-]+)',
    ]
    for pattern in patterns:
        m = re.search(pattern, text)
        if m:
            return m.group(1).strip()

    return None


def _extract_expiry_date(text: str) -> Optional[str]:
    """提取有效期至；优先找「有效期至」等关键词后的日期"""
    dates = _extract_dates(text)
    if not dates:
        return None

    # 按位置排序
    dates.sort(key=lambda x: x[1])
    date_values = [d for d, _ in dates]

    # 启发式：找「有效期至/有效期限/截止日期/失效日期/营业期限至」后面的日期作为有效期
    expiry_keywords = ['有效期至', '有效期限', '截止日期', '失效日期', '期限至', '期限']
    for d, pos in dates:
        # 在日期位置前 80 字符内找关键词
        ctx_before = text[max(0, pos - 80):pos + 20]
        if any(k in ctx_before for k in expiry_keywords):
            return d

    # 未命中关键词：如果有多个日期，取最大值作为有效期
    if len(date_values) >= 2:
        return max(date_values)

    # 只有一个日期时，也返回它（可能是有效期）
    if len(date_values) == 1:
        return date_values[0]

    return None


def _ocr_image(image: Image.Image) -> str:
    """对单张图片执行 OCR"""
    if not HAS_TESSERACT:
        return ''
    # 中文+英文
    return pytesseract.image_to_string(image, lang='chi_sim+eng') or ''


def _ocr_pdf(file_path: str) -> str:
    """对 PDF 每页截图后 OCR"""
    if not HAS_PYMUPDF or not HAS_PIL:
        return ''
    text_parts = []
    doc = fitz.open(file_path)
    try:
        for page in doc:
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x 放大提升识别率
            img = Image.frombytes('RGB', [pix.width, pix.height], pix.samples)
            page_text = _ocr_image(img)
            if page_text:
                text_parts.append(page_text)
    finally:
        doc.close()
    return '\n'.join(text_parts)


def recognize_qualification(file_url: str, qualification_type: str = '') -> dict:
    """
    识别资质文件，返回结构化字段
    file_url 应为本地可解析的相对/绝对路径或 HTTP URL
    """
    if not HAS_TESSERACT:
        return {'license_number': '', 'expiry_date': '', 'raw_text': '', 'error': 'OCR 引擎未就绪'}

    # 从 URL 解析本地路径
    path = file_url
    if path.startswith('http://') or path.startswith('https://'):
        # 去掉域名，得到 /media/qualifications/xxx.ext
        from urllib.parse import urlparse
        parsed = urlparse(path)
        path = parsed.path
    if path.startswith(settings.MEDIA_URL):
        relative = path[len(settings.MEDIA_URL):]
    else:
        relative = path.lstrip('/')
    local_path = os.path.join(settings.MEDIA_ROOT, relative)
    local_path = os.path.normpath(local_path)

    if not os.path.exists(local_path):
        return {'license_number': '', 'expiry_date': '', 'raw_text': '', 'error': '文件不存在'}

    ext = os.path.splitext(local_path)[1].lower()
    raw_text = ''

    try:
        if ext == '.pdf':
            raw_text = _ocr_pdf(local_path)
        elif ext in {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'}:
            with Image.open(local_path) as img:
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                raw_text = _ocr_image(img)
        else:
            return {'license_number': '', 'expiry_date': '', 'raw_text': '', 'error': '不支持的文件类型'}
    except Exception as e:
        return {'license_number': '', 'expiry_date': '', 'raw_text': '', 'error': f'OCR 失败: {e}'}

    license_number = _extract_license_number(raw_text, qualification_type)
    expiry_date = _extract_expiry_date(raw_text)

    return {
        'license_number': license_number or '',
        'expiry_date': expiry_date or '',
        'raw_text': raw_text.strip(),
        'error': '',
    }
