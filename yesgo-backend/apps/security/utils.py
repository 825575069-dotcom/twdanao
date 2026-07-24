"""
数据脱敏工具 —— 手机号/身份证/银行卡/邮箱/姓名 脱敏
供 API 响应层和审计日志层调用
"""

import re


def mask_phone(phone: str) -> str:
    """手机号脱敏：138****8888"""
    if not phone or len(phone) < 7:
        return phone
    return phone[:3] + '****' + phone[-4:]


def mask_id_card(id_card: str) -> str:
    """身份证脱敏：110***********1234"""
    if not id_card or len(id_card) < 10:
        return id_card
    return id_card[:3] + '*' * (len(id_card) - 7) + id_card[-4:]


def mask_bank_card(card: str) -> str:
    """银行卡脱敏：6222***********1234"""
    if not card or len(card) < 8:
        return card
    return card[:4] + '*' * (len(card) - 8) + card[-4:]


def mask_email(email: str) -> str:
    """邮箱脱敏：z***@example.com"""
    if not email or '@' not in email:
        return email
    name, domain = email.split('@', 1)
    if len(name) <= 1:
        return '*' + '@' + domain
    return name[0] + '***@' + domain


def mask_name(name: str) -> str:
    """姓名脱敏：张** / 欧阳**"""
    if not name:
        return name
    if len(name) <= 1:
        return name
    if len(name) == 2:
        return name[0] + '*'
    return name[0] + '*' * (len(name) - 2) + name[-1]


def mask_address(addr: str) -> str:
    """地址脱敏：保留前6个字符，后面用*替代"""
    if not addr or len(addr) < 6:
        return addr
    return addr[:6] + '****'


def mask_value(key: str, value, config=None):
    """
    根据字段名和配置自动脱敏
    config: SecurityConfig 对象或 dict
    """
    if value is None:
        return value

    # 从 key 名判断字段类型
    key_lower = key.lower()
    str_value = str(value)

    # 配置开关
    if config:
        mask_phone_enabled = getattr(config, 'mask_phone', True) if hasattr(config, 'mask_phone') else config.get('mask_phone', True) if isinstance(config, dict) else True
        mask_id_card_enabled = getattr(config, 'mask_id_card', True) if hasattr(config, 'mask_id_card') else config.get('mask_id_card', True) if isinstance(config, dict) else True
        mask_bank_card_enabled = getattr(config, 'mask_bank_card', True) if hasattr(config, 'mask_bank_card') else config.get('mask_bank_card', True) if isinstance(config, dict) else True
        mask_email_enabled = getattr(config, 'mask_email', False) if hasattr(config, 'mask_email') else config.get('mask_email', False) if isinstance(config, dict) else False
        mask_name_enabled = getattr(config, 'mask_name', False) if hasattr(config, 'mask_name') else config.get('mask_name', False) if isinstance(config, dict) else False
    else:
        mask_phone_enabled = mask_id_card_enabled = mask_bank_card_enabled = True
        mask_email_enabled = mask_name_enabled = False

    # 手机号
    if mask_phone_enabled and re.match(r'^1[3-9]\d{9}$', str_value):
        return mask_phone(str_value)

    # 身份证（18位或15位）
    if mask_id_card_enabled and re.match(r'^\d{15}$|^\d{17}[\dXx]$', str_value):
        return mask_id_card(str_value)

    # 银行卡（16-19位数字）
    if mask_bank_card_enabled and re.match(r'^\d{16,19}$', str_value):
        return mask_bank_card(str_value)

    # 邮箱
    if mask_email_enabled and '@' in str_value and re.match(r'^[\w.+-]+@[\w-]+\.[\w.-]+$', str_value):
        return mask_email(str_value)

    # 姓名字段
    if mask_name_enabled and any(k in key_lower for k in ['name', 'contact', '联系人', '姓名']):
        if len(str_value) >= 2 and len(str_value) <= 4 and not str_value.isdigit():
            return mask_name(str_value)

    # 地址字段
    if any(k in key_lower for k in ['address', 'addr', '地址']):
        return mask_address(str_value)

    return value


def mask_dict(data: dict, config=None) -> dict:
    """递归脱敏字典中的敏感字段"""
    if not isinstance(data, dict):
        return data
    result = {}
    for key, value in data.items():
        if isinstance(value, dict):
            result[key] = mask_dict(value, config)
        elif isinstance(value, list):
            result[key] = [mask_dict(v, config) if isinstance(v, dict) else mask_value(key, v, config) for v in value]
        else:
            result[key] = mask_value(key, value, config)
    return result


def mask_request_body(body: dict, config=None) -> dict:
    """脱敏请求体（用于审计日志记录）"""
    if not body:
        return {}
    return mask_dict(body, config)
