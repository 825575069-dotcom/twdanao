"""
采购兔首页提示词种子脚本
按 6 个分类每个 10 条，共 60 条 purchase_home 提示词写入 platform_prompt 表
运行方式：python manage.py shell < seed_purchase_home_prompts.py
"""
from apps.platform.models import Prompt

PROMPTS = [
    # ========== 推荐 recommend ==========
    {
        "category": "recommend",
        "title": "今日补货推荐",
        "icon": "package",
        "content": "请结合当前库存和销售趋势，帮我推荐今天需要优先补货的药品清单，并说明建议采购数量。",
    },
    {
        "category": "recommend",
        "title": "热销品种分析",
        "icon": "bar-chart-3",
        "content": "分析本周热销药品排行，标注库存紧张或即将断货的品种，并给出补货建议。",
    },
    {
        "category": "recommend",
        "title": "滞销品处理",
        "icon": "trending-down",
        "content": "找出近30天动销较慢的滞销品种，分析原因并给出促销、退货或调拨处理建议。",
    },
    {
        "category": "recommend",
        "title": "新品引进建议",
        "icon": "sparkles",
        "content": "基于现有品类结构和销售数据，推荐适合本店/本机构引进的新品种，并说明理由。",
    },
    {
        "category": "recommend",
        "title": "库存周转优化",
        "icon": "bar-chart-3",
        "content": "分析整体库存周转率，识别周转异常品类，并提供优化采购节奏和库存结构的方案。",
    },
    {
        "category": "recommend",
        "title": "价格异常监控",
        "icon": "target",
        "content": "检查近期采购价格偏离正常区间的品种，提示价格异常风险并建议复核供应商报价。",
    },
    {
        "category": "recommend",
        "title": "供应商评级",
        "icon": "users",
        "content": "根据交货及时率、到货合格率、价格竞争力等维度，评估主要供应商综合表现并排名。",
    },
    {
        "category": "recommend",
        "title": "采购计划生成",
        "icon": "file-text",
        "content": "综合库存、销量和促销计划，帮我生成下周采购计划建议，包含品种、数量和推荐供应商。",
    },
    {
        "category": "recommend",
        "title": "效期预警",
        "icon": "target",
        "content": "列出近效期（6个月内到期）的商品清单，给出促销、退换货或调拨处理优先级建议。",
    },
    {
        "category": "recommend",
        "title": "智能选品",
        "icon": "lightbulb",
        "content": "结合季节因素、历史销量和毛利贡献，智能推荐本月重点采购和主推品种。",
    },

    # ========== 平台运营 platform ==========
    {
        "category": "platform",
        "title": "平台活动报名",
        "icon": "megaphone",
        "content": "帮我查看当前可参与的集采、促销或平台活动，分析报名条件、优惠力度并给出报名建议。",
    },
    {
        "category": "platform",
        "title": "促销政策解读",
        "icon": "file-text",
        "content": "解读当前平台促销政策和活动规则，说明可享受的折扣、返点及注意事项。",
    },
    {
        "category": "platform",
        "title": "订单履约监控",
        "icon": "truck",
        "content": "查看我在平台上的采购订单履约情况，标记超时未发货、缺货或物流异常的订单。",
    },
    {
        "category": "platform",
        "title": "平台比价分析",
        "icon": "bar-chart-3",
        "content": "对比平台上同一品种多个供应商的报价、起订量和账期，给出最优采购选择。",
    },
    {
        "category": "platform",
        "title": "活动效果复盘",
        "icon": "bar-chart-3",
        "content": "分析上次平台促销活动的销售额、毛利和库存消化情况，输出复盘报告。",
    },
    {
        "category": "platform",
        "title": "平台规则更新",
        "icon": "book-open",
        "content": "汇总近期平台采购规则、资质要求或结算规则的变化，并说明对采购的影响。",
    },
    {
        "category": "platform",
        "title": "供应商资质核查",
        "icon": "search",
        "content": "检查平台合作供应商的资质证照有效期，预警即将过期或已失效的资质。",
    },
    {
        "category": "platform",
        "title": "平台账期管理",
        "icon": "file-text",
        "content": "查询平台应付账款、账期使用情况，提示即将到期需付款的订单和可优化账期策略。",
    },
    {
        "category": "platform",
        "title": "退换货处理",
        "icon": "message-circle",
        "content": "帮我处理平台采购中的退换货申请，核对可退数量、退款金额和流程进度。",
    },
    {
        "category": "platform",
        "title": "平台公告汇总",
        "icon": "megaphone",
        "content": "汇总近期平台上与采购相关的重要公告、调价通知和活动预告。",
    },

    # ========== 营销跟客 marketing ==========
    {
        "category": "marketing",
        "title": "客户拜访准备",
        "icon": "users",
        "content": "生成今日客户拜访清单，包含客户近况、历史采购数据和推荐沟通话题。",
    },
    {
        "category": "marketing",
        "title": "客户需求分析",
        "icon": "bar-chart-3",
        "content": "分析重点客户的采购偏好、频次和品类结构，预测下一阶段采购需求。",
    },
    {
        "category": "marketing",
        "title": "拜访记录整理",
        "icon": "file-text",
        "content": "整理本周客户拜访记录，提炼关键需求、异议和后续跟进事项。",
    },
    {
        "category": "marketing",
        "title": "客户流失预警",
        "icon": "trending-down",
        "content": "识别近期采购额明显下降或长时间未下单的客户，给出挽回建议和跟进策略。",
    },
    {
        "category": "marketing",
        "title": "促销方案推荐",
        "icon": "sparkles",
        "content": "为指定客户量身定制促销方案，包括推荐品种、优惠力度和预期效果。",
    },
    {
        "category": "marketing",
        "title": "客情维护提醒",
        "icon": "users",
        "content": "列出近期需要维护客情的客户，推荐维护方式（拜访、电话、活动邀请等）。",
    },
    {
        "category": "marketing",
        "title": "销售机会挖掘",
        "icon": "lightbulb",
        "content": "分析客户历史采购和用药场景，挖掘潜在的增量采购机会和新品推广机会。",
    },
    {
        "category": "marketing",
        "title": "客户分级管理",
        "icon": "target",
        "content": "根据采购额、毛利贡献和合作稳定性对客户进行分级，输出分级清单和维护策略。",
    },
    {
        "category": "marketing",
        "title": "跟进计划生成",
        "icon": "file-text",
        "content": "生成下周客户跟进计划，明确每日拜访/联系对象、目的和重点推荐品种。",
    },
    {
        "category": "marketing",
        "title": "客户反馈汇总",
        "icon": "message-circle",
        "content": "汇总近期客户反馈、投诉和建议，分类整理并给出处理优先级建议。",
    },

    # ========== 流向管控 flow ==========
    {
        "category": "flow",
        "title": "流向数据查询",
        "icon": "search",
        "content": "查询指定品种在近期内的终端流向数据，按区域、客户或时间维度汇总。",
    },
    {
        "category": "flow",
        "title": "窜货预警",
        "icon": "bot",
        "content": "识别异常流向数据，预警可能的窜货风险，标注可疑批次和区域。",
    },
    {
        "category": "flow",
        "title": "终端覆盖分析",
        "icon": "bar-chart-3",
        "content": "分析重点品种终端覆盖情况，找出空白终端和覆盖薄弱的区域。",
    },
    {
        "category": "flow",
        "title": "流向趋势图",
        "icon": "bar-chart-3",
        "content": "生成重点品种近3个月的流向趋势分析，识别增长、下滑或季节性波动。",
    },
    {
        "category": "flow",
        "title": "区域销售对比",
        "icon": "target",
        "content": "对比各区域流向数据，分析区域间差异并给出市场布局建议。",
    },
    {
        "category": "flow",
        "title": "库存分布查询",
        "icon": "package",
        "content": "查询商品在总仓、分仓及渠道中的库存分布情况，提示库存不均衡风险。",
    },
    {
        "category": "flow",
        "title": "物流异常监控",
        "icon": "truck",
        "content": "监控在途物流异常订单，包括超时、滞留、拒收等情况并给出处理建议。",
    },
    {
        "category": "flow",
        "title": "退货流向分析",
        "icon": "trending-down",
        "content": "分析退货商品的流向和原因，识别高频退货品种、区域和客户。",
    },
    {
        "category": "flow",
        "title": "渠道库存预警",
        "icon": "target",
        "content": "监控渠道库存安全水位，对低于预警线或高于上限的渠道给出调拨建议。",
    },
    {
        "category": "flow",
        "title": "流向数据导出",
        "icon": "file-text",
        "content": "按品种、区域、时间等条件生成流向数据报表，并提供导出格式建议。",
    },

    # ========== 智能采购 purchase ==========
    {
        "category": "purchase",
        "title": "智能比价",
        "icon": "bar-chart-3",
        "content": "对比多个供应商同一品种的报价、规格、效期和起订量，给出最优采购选择。",
    },
    {
        "category": "purchase",
        "title": "采购订单跟踪",
        "icon": "truck",
        "content": "跟踪未结采购订单状态，列出待发货、在途、待验收和超期订单。",
    },
    {
        "category": "purchase",
        "title": "最优采购方案",
        "icon": "lightbulb",
        "content": "根据库存、销量预测和供应商报价，生成最优采购方案（品种、数量、供应商）。",
    },
    {
        "category": "purchase",
        "title": "供应商对账",
        "icon": "file-text",
        "content": "生成本月与主要供应商的对账单，核对采购金额、到货数量和已付款情况。",
    },
    {
        "category": "purchase",
        "title": "采购成本分析",
        "icon": "bar-chart-3",
        "content": "分析本月采购成本构成、同比变化及主要影响因素，提出降本建议。",
    },
    {
        "category": "purchase",
        "title": "缺货预警处理",
        "icon": "bot",
        "content": "查看当前缺货或库存预警品种，推荐紧急采购渠道和替代品种。",
    },
    {
        "category": "purchase",
        "title": "集采方案制定",
        "icon": "package",
        "content": "结合平台集采活动，制定集采品种清单、数量和供应商分配方案。",
    },
    {
        "category": "purchase",
        "title": "采购合同管理",
        "icon": "file-text",
        "content": "查询即将到期或已到期的采购合同，提示续签或重新招标事项。",
    },
    {
        "category": "purchase",
        "title": "到货验收提醒",
        "icon": "truck",
        "content": "提醒今日到货验收事项，列出待验收订单、重点检查项目和异常处理流程。",
    },
    {
        "category": "purchase",
        "title": "采购预算控制",
        "icon": "target",
        "content": "监控本月采购预算执行情况，提示超预算风险并给出控制建议。",
    },

    # ========== 学术培训 academic ==========
    {
        "category": "academic",
        "title": "产品知识培训",
        "icon": "graduation-cap",
        "content": "生成某药品的核心产品知识培训要点，包括适应症、用法用量和注意事项。",
    },
    {
        "category": "academic",
        "title": "竞品对比分析",
        "icon": "bar-chart-3",
        "content": "对比本品与主要竞品在疗效、价格、适应症和市场份额方面的差异。",
    },
    {
        "category": "academic",
        "title": "学术资料检索",
        "icon": "search",
        "content": "检索指定药品相关的学术文献、指南和临床试验资料，并给出核心结论摘要。",
    },
    {
        "category": "academic",
        "title": "科室会讲稿",
        "icon": "file-text",
        "content": "为指定科室生成产品介绍会讲稿，突出临床价值和差异化优势。",
    },
    {
        "category": "academic",
        "title": "临床问题解答",
        "icon": "message-circle",
        "content": "解答常见临床用药问题，提供循证依据和用药建议。",
    },
    {
        "category": "academic",
        "title": "用药指南查询",
        "icon": "book-open",
        "content": "查询指定药品的说明书、用法用量、禁忌症和药物相互作用信息。",
    },
    {
        "category": "academic",
        "title": "不良反应处理",
        "icon": "target",
        "content": "查询药品常见不良反应及处理方案，提供患者教育和上报建议。",
    },
    {
        "category": "academic",
        "title": "学术会议准备",
        "icon": "graduation-cap",
        "content": "为 upcoming 学术会议生成参会准备清单、重点议题和会后跟进计划。",
    },
    {
        "category": "academic",
        "title": "专家意见整理",
        "icon": "brain",
        "content": "整理专家对产品或治疗方案的观点，提炼可用于市场推广的核心话术。",
    },
    {
        "category": "academic",
        "title": "培训考核题库",
        "icon": "target",
        "content": "基于产品知识生成学术培训考核题目（单选/多选/简答），附参考答案。",
    },
]

# 写入数据库：按分类和排序批量创建
objects = []
for idx, item in enumerate(PROMPTS, start=1):
    # 每个分类内部按原顺序排序（10, 20, 30...）
    sort = ((list({p['category'] for p in PROMPTS}).index(item['category']) + 1) * 1000) + (idx % 10 or 10)
    objects.append(Prompt(
        prompt_type='purchase_home',
        category=item['category'],
        title=item['title'],
        icon=item['icon'],
        content=item['content'],
        enabled=True,
        sort=sort,
    ))

# 为避免重复执行导致重复数据，先按 title + category + prompt_type 去重创建
existing_keys = set(
    Prompt.objects.filter(prompt_type='purchase_home')
    .values_list('title', 'category')
)
created = 0
skipped = 0
for p in objects:
    if (p.title, p.category) in existing_keys:
        skipped += 1
        continue
    p.save()
    created += 1
    existing_keys.add((p.title, p.category))

print(f"[OK] 采购兔首页提示词：新增 {created} 条，跳过 {skipped} 条（已存在），总计 {Prompt.objects.filter(prompt_type='purchase_home').count()} 条")
