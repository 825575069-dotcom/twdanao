"""种子数据管理命令 — python manage.py seed"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import random

from apps.platform.models import (
    Tenant, Role, TenantUser, Package, PackageQuota,
    Agent, AgentConfig, WorkflowTemplate,
    DifyConfig, DifyWorkflow, Prompt,
    PlatformRole, PlatformUser,
)
from apps.tenant_db.models import Product, Customer, Order, Warehouse, InventoryAlert
from apps.tenant_ext.models import KnowledgeDoc, MediaAsset, Task, CreditLedger, Skill, SaaSConnection, DataConnector
from apps.platform.workflow_schema import normalize_workflow_steps, normalize_edges
from apps.model_gateway.models import AIModel
from apps.chat.models import Conversation, Message


class Command(BaseCommand):
    help = '初始化种子数据（创建默认租户、管理员、业务数据等）'

    def handle(self, *args, **options):
        self.stdout.write('🌱 开始初始化种子数据...')

        self._create_platform_roles()
        self._create_models()
        self._create_agents()
        self._create_tenant()
        self._create_users()
        self._create_package()
        self._create_agent_configs()
        self._create_dify_config()
        self._create_workflow_templates()
        self._create_products()
        self._create_customers()
        self._create_orders()
        self._create_warehouses()
        self._create_knowledge()
        self._create_media()
        self._create_tasks()
        self._create_skills()
        self._create_saas()
        self._create_connectors()
        self._create_credit_ledger()
        self._create_conversation()
        self._create_prompts()

        self.stdout.write(self.style.SUCCESS('✅ 种子数据初始化完成！'))
        self.stdout.write(f'   租户: {Tenant.objects.count()} 个')
        self.stdout.write(f'   用户: {User.objects.count()} 个')
        self.stdout.write(f'   商品: {Product.objects.count()} 个')
        self.stdout.write(f'   客户: {Customer.objects.count()} 个')
        self.stdout.write(f'   订单: {Order.objects.count()} 个')

    def _create_platform_roles(self):
        """创建默认平台角色 + 将现有管理员关联到平台角色"""
        from apps.platform.permissions import PLATFORM_PERMISSION_CATALOG, TENANT_PERMISSION_CATALOG
        all_platform_codes = [p['code'] for p in PLATFORM_PERMISSION_CATALOG]
        all_tenant_codes = [p['code'] for p in TENANT_PERMISSION_CATALOG]

        platform_roles = [
            {
                'code': 'super_admin',
                'name': '超级管理员',
                'description': '拥有平台全部权限，管理天网大脑中台所有模块',
                'permissions': all_platform_codes,
            },
            {
                'code': 'ops_admin',
                'name': '运营管理员',
                'description': '管理租户、权限、安全审计，只读技术模块',
                'permissions': [
                    'platform.dashboard.view',
                    'platform.tenants.view', 'platform.tenants.manage', 'platform.tenants.members',
                    'platform.permissions.view',
                    'platform.prompts.view',
                    'platform.security.view',
                    'platform.database.view',
                    'platform.models.view',
                    'platform.agents.view',
                    'platform.workflows.view',
                ],
            },
            {
                'code': 'tech_admin',
                'name': '技术管理员',
                'description': '管理数据库、模型、智能体、工作流，只读业务模块',
                'permissions': [
                    'platform.dashboard.view',
                    'platform.database.view', 'platform.database.manage',
                    'platform.models.view', 'platform.models.manage',
                    'platform.agents.view', 'platform.agents.manage',
                    'platform.workflows.view', 'platform.workflows.manage',
                    'platform.prompts.view', 'platform.prompts.manage',
                    'platform.tenants.view',
                    'platform.security.view',
                ],
            },
            {
                'code': 'auditor',
                'name': '审计员',
                'description': '只读全部模块，可管理安全策略',
                'permissions': [
                    'platform.dashboard.view',
                    'platform.tenants.view',
                    'platform.database.view',
                    'platform.models.view',
                    'platform.agents.view',
                    'platform.workflows.view',
                    'platform.permissions.view',
                    'platform.prompts.view',
                    'platform.security.view', 'platform.security.manage',
                ],
            },
        ]
        for r in platform_roles:
            PlatformRole.objects.get_or_create(code=r['code'], defaults=r)

        # 将 is_superuser / is_staff 用户关联到超级管理员平台角色
        super_role = PlatformRole.objects.get(code='super_admin')
        for user in User.objects.filter(is_superuser=True):
            PlatformUser.objects.get_or_create(user=user, defaults={'role': super_role, 'enabled': True})

        # 更新租户角色的 permissions 从旧码 → tenant.* 前缀
        admin_role = Role.objects.filter(code='admin').first()
        if admin_role and (not admin_role.permissions or 'chat.view' in admin_role.permissions):
            admin_role.permissions = all_tenant_codes
            admin_role.save()

        for role in Role.objects.exclude(code='admin'):
            if role.permissions:
                new_perms = []
                for p in role.permissions:
                    if p == '*':
                        new_perms = ['*']
                        break
                    if p.startswith('tenant.'):
                        new_perms.append(p)
                    elif p.startswith('agent.'):
                        new_perms.append(f'tenant.{p}')
                    elif p == 'members.manage':
                        new_perms.append('tenant.members.manage')
                    elif p == 'credits.assign':
                        new_perms.append('tenant.credits.assign')
                    elif p == 'prompts.manage':
                        new_perms.append('tenant.prompts.view')
                    else:
                        new_perms.append(f'tenant.{p}')
                if new_perms and new_perms != role.permissions:
                    role.permissions = new_perms
                    role.save(update_fields=['permissions'])

        self.stdout.write('   ✅ 平台角色已创建，租户角色权限已更新为 tenant.* 前缀')

    def _create_models(self):
        models = [
            {'name': '通义千问-Max', 'vendor': '阿里云', 'type': 'commercial', 'context_k': 32, 'status': 'ready', 'description': '阿里云通义千问旗舰模型'},
            {'name': '混元-Pro', 'vendor': '腾讯', 'type': 'commercial', 'context_k': 32, 'status': 'ready', 'description': '腾讯混元大模型专业版'},
            {'name': 'GPT-4o', 'vendor': 'OpenAI', 'type': 'commercial', 'context_k': 128, 'status': 'ready', 'description': 'OpenAI 多模态旗舰模型'},
            {'name': 'Claude 3.5 Sonnet', 'vendor': 'Anthropic', 'type': 'commercial', 'context_k': 200, 'status': 'ready', 'description': 'Anthropic 高性能模型'},
            {'name': '文心一言 4.0', 'vendor': '百度', 'type': 'commercial', 'context_k': 8, 'status': 'ready', 'description': '百度文心大模型'},
            {'name': '垂直行业 Pro', 'vendor': 'YesGo 精调', 'type': 'commercial', 'context_k': 64, 'status': 'ready', 'description': '医药行业精调专用模型'},
            {'name': 'Qwen2.5-72B', 'vendor': '阿里(开源)', 'type': 'open', 'context_k': 32, 'status': 'ready', 'description': 'Qwen2.5 开源72B'},
            {'name': 'DeepSeek-V3', 'vendor': '深度求索(开源)', 'type': 'open', 'context_k': 64, 'status': 'ready', 'description': 'DeepSeek V3 开源模型'},
            {'name': 'Llama-3.1-70B', 'vendor': 'Meta(开源)', 'type': 'open', 'context_k': 128, 'status': 'deploying', 'description': 'Meta Llama 3.1 70B'},
            {'name': 'ChatGLM4-9B', 'vendor': '智谱(开源)', 'type': 'open', 'context_k': 128, 'status': 'offline', 'description': '智谱 ChatGLM4 9B'},
        ]
        for m in models:
            AIModel.objects.get_or_create(name=m['name'], defaults=m)

    def _create_agents(self):
        """平台智能体定义（第二层发布，第三层消费）"""
        agents = [
            {
                'agent_id': 'control', 'code': '', 'name': 'YesGo 经理兔',
                'role': '意图识别与智能体调度', 'emoji': '🧠', 'scarf_color': 'purple',
                'accent': '#818cf8',
                'description': '统筹拆解任务、调度五大业务兔、统一管控模型 / 算力 / 知识库 / SaaS 底座接口',
                'capabilities': ['意图识别', '智能体调度', '结果汇总', '算力管控', '知识库接入'],
                'stats': {'tasks': 12, 'capabilities': 5, 'materials': 8, 'outputs': 36},
                'default_workflow': [
                    {'id': 'w1', 'name': '意图识别', 'prompt': '解析用户自然语言输入，识别业务意图与关键实体。'},
                    {'id': 'w2', 'name': '智能体调度', 'prompt': '根据意图匹配最合适的业务智能体，并注入上下文。'},
                    {'id': 'w3', 'name': '结果回流', 'prompt': '汇总智能体执行结果，以自然语言回复用户。'},
                ],
                'sort_order': 0,
            },
            {
                'agent_id': 'ops', 'code': 'operations', 'name': '运营兔',
                'role': '经营分析 / 促销测算', 'emoji': '📊', 'scarf_color': 'darkgreen',
                'accent': '#34d399',
                'description': '促销推荐、B2B 比价定价、客户跟进提示、经营全景分析',
                'capabilities': ['经营分析', '促销测算', 'B2B 比价', '客户分层', '库存预警'],
                'stats': {'tasks': 5, 'capabilities': 5, 'materials': 14, 'outputs': 42},
                'default_workflow': [
                    {'id': 'w1', 'name': '读取经营数据', 'prompt': '从 SaaS 底座读取订单、销量、库存等经营全景数据，按时间维度聚合。', 'data_source': 'dashboard'},
                    {'id': 'w2', 'name': '测算促销弹性', 'prompt': '根据历史促销数据测算价格弹性与毛利空间，识别高弹性商品。'},
                    {'id': 'w3', 'name': '生成经营建议', 'prompt': '输出促销方案、定价建议与库存周转优化建议，并标注风险点。'},
                ],
                'sort_order': 1,
            },
            {
                'agent_id': 'crm', 'code': 'marketing', 'name': '跟客兔',
                'role': '客户自动沟通', 'emoji': '💬', 'scarf_color': 'royalblue',
                'accent': '#38bdf8',
                'description': '面向药店 / 诊所自动标准化沟通、跟进台账、人工随时接管',
                'capabilities': ['客户跟进', '企微触达', '话术生成', '跟进台账', '人工接管'],
                'stats': {'tasks': 3, 'capabilities': 1, 'materials': 22, 'outputs': 99},
                'default_workflow': [
                    {'id': 'w1', 'name': '读取客户档案', 'prompt': '从 CRM 加载客户主数据、跟进记录与历史沟通内容。', 'data_source': 'customer'},
                    {'id': 'w2', 'name': '分层跟进策略', 'prompt': '按客户活跃度、采购频次、区域等因素分层，制定差异化跟进策略。'},
                    {'id': 'w3', 'name': '生成话术建议', 'prompt': '为每层客户生成标准化沟通话术与拜访/触达节奏。'},
                ],
                'sort_order': 2,
            },
            {
                'agent_id': 'purchase', 'code': 'procurement', 'name': '采购兔',
                'role': '三套采购方案', 'emoji': '🛒', 'scarf_color': 'yellow',
                'accent': '#fbbf24',
                'description': '送货最快 / 价格最优 / 综合平衡，三套方案一键回写 SaaS',
                'capabilities': ['库存缺口', '供应商比价', '三套方案', '一键下单', '到货预测'],
                'stats': {'tasks': 7, 'capabilities': 3, 'materials': 11, 'outputs': 28},
                'default_workflow': [
                    {'id': 'w1', 'name': '读取库存与供应商', 'prompt': '读取库存缺口、安全库存阈值及供应商主数据（到货时效、报价系数）。', 'data_source': 'stock'},
                    {'id': 'w2', 'name': '测算补货缺口', 'prompt': '汇总低于安全库存的商品与仓库，计算总补货量。', 'data_source': 'procurement'},
                    {'id': 'w3', 'name': '生成三套方案', 'prompt': '分别生成最快到货、价格最优、综合均衡三套采购方案。'},
                    {'id': 'w4', 'name': '回写 SaaS 订单', 'prompt': '将推荐方案回写为采购订单，并通知供应商备货。'},
                ],
                'sort_order': 3,
            },
            {
                'agent_id': 'flow', 'code': 'distribution', 'name': '流向兔',
                'role': '窜货 / 库存预警', 'emoji': '🗺️', 'scarf_color': 'orangered',
                'accent': '#fb7185',
                'description': '窜货跨区域监控、渠道滞销预警、销量智能预测',
                'capabilities': ['流向监控', '窜货预警', '渠道分析', '滞销识别', '销量预测'],
                'stats': {'tasks': 4, 'capabilities': 2, 'materials': 9, 'outputs': 55},
                'default_workflow': [
                    {'id': 'w1', 'name': '读取流向数据', 'prompt': '拉取商品跨区域流向记录，包含发货地与销售地。', 'data_source': 'flow'},
                    {'id': 'w2', 'name': '异常路径识别', 'prompt': '比对授权销售区域，识别窜货与异常低价倾销路径。'},
                    {'id': 'w3', 'name': '生成监控报告', 'prompt': '输出异常清单、预警等级与处理建议。', 'data_source': 'dashboard'},
                ],
                'sort_order': 4,
            },
            {
                'agent_id': 'academic', 'code': 'academic', 'name': '学术兔',
                'role': '学术内容生成', 'emoji': '🎓', 'scarf_color': 'red',
                'accent': '#a78bfa',
                'description': '合规学术素材、分层内容定制、配合跟客自动下发',
                'capabilities': ['学术检索', '内容生成', '合规审核', '分层定制', '素材下发'],
                'stats': {'tasks': 2, 'capabilities': 4, 'materials': 31, 'outputs': 18},
                'default_workflow': [
                    {'id': 'w1', 'name': '检索合规素材', 'prompt': '从知识库检索学术文献、合规素材与产品资料。'},
                    {'id': 'w2', 'name': '规划内容结构', 'prompt': '按目标受众（医生/药师/患者）分层规划内容结构与关键信息点。'},
                    {'id': 'w3', 'name': '生成学术内容', 'prompt': '生成课件大纲、患教素材与合规话术。'},
                ],
                'sort_order': 5,
            },
        ]
        for a in agents:
            Agent.objects.get_or_create(agent_id=a['agent_id'], defaults=a)

    def _create_workflow_templates(self):
        """工作流模板（平台预置）"""
        templates = [
            {
                'name': '库存预警→采购闭环',
                'description': '运营兔监控库存指标→采购兔生成补货方案→回写 SaaS 订单',
                'category': 'preset',
                'tags': ['库存', '采购', '供应链'],
                'steps': [
                    {'id': 's1', 'agentId': 'ops', 'name': '库存监控', 'prompt': '读取各仓库库存数据，对比安全库存阈值，生成预警清单', 'retryCount': 2, 'timeout': 30000, 'modelId': 'qwen-max', 'triggerCondition': '库存低于安全线自动触发 / 手动触发', 'data_source': 'stock'},
                    {'id': 's2', 'agentId': 'purchase', 'name': '生成采购方案', 'prompt': '根据库存缺口匹配供应商，生成三套采购方案（最快/最优/均衡）', 'retryCount': 3, 'timeout': 60000, 'modelId': 'qwen-max', 'triggerCondition': 's1 完成后自动触发', 'data_source': 'procurement'},
                    {'id': 's3', 'agentId': 'purchase', 'name': '回写订单', 'prompt': '将采纳的方案回写为 SaaS 采购订单', 'retryCount': 2, 'timeout': 30000, 'modelId': 'hunyuan-pro', 'triggerCondition': '用户确认方案后触发'},
                ],
                'edges': [
                    {'from': 's1', 'to': 's2', 'type': 'sequential'},
                    {'from': 's2', 'to': 's3', 'type': 'sequential'},
                ],
                'sort_order': 1,
            },
            {
                'name': '客户分析→精准触达',
                'description': '跟客兔分析客户→运营兔分层→学术兔生成内容→跟客兔执行触达',
                'category': 'preset',
                'tags': ['客户', '营销', '学术'],
                'steps': [
                    {'id': 's1', 'agentId': 'crm', 'name': '客户分层', 'prompt': '读取客户档案与历史交易，按活跃度、采购频次分层', 'retryCount': 2, 'timeout': 30000, 'modelId': 'hunyuan-pro', 'triggerCondition': '每周一自动 / 手动触发', 'data_source': 'customer'},
                    {'id': 's2a', 'agentId': 'ops', 'name': '经营分析', 'prompt': '分析各层级客户的毛利贡献与增长潜力', 'retryCount': 2, 'timeout': 30000, 'modelId': 'qwen-max', 'triggerCondition': 's1 完成后并行触发', 'data_source': 'dashboard'},
                    {'id': 's2b', 'agentId': 'academic', 'name': '内容生成', 'prompt': '为不同层级客户生成差异化沟通内容与学术素材', 'retryCount': 2, 'timeout': 45000, 'modelId': 'qwen25-72b', 'triggerCondition': 's1 完成后并行触发'},
                    {'id': 's3', 'agentId': 'crm', 'name': '执行触达', 'prompt': '按策略将内容下发给目标客户，生成跟进台账', 'retryCount': 1, 'timeout': 60000, 'modelId': 'hunyuan-pro', 'triggerCondition': 's2a 和 s2b 均完成后触发'},
                ],
                'edges': [
                    {'from': 's1', 'to': 's2a', 'type': 'parallel'},
                    {'from': 's1', 'to': 's2b', 'type': 'parallel'},
                    {'from': 's2a', 'to': 's3', 'type': 'sequential'},
                    {'from': 's2b', 'to': 's3', 'type': 'sequential'},
                ],
                'sort_order': 2,
            },
            {
                'name': '流向监控→窜货预警',
                'description': '流向兔拉取数据→运营兔辅助分析→生成预警报告',
                'category': 'preset',
                'tags': ['流向', '窜货', '合规'],
                'steps': [
                    {'id': 's1', 'agentId': 'flow', 'name': '拉取流向', 'prompt': '拉取全渠道商品流向数据，比对授权销售区域', 'retryCount': 3, 'timeout': 45000, 'modelId': 'deepseek-v3', 'triggerCondition': '每日自动 / 手动触发', 'data_source': 'flow'},
                    {'id': 's2', 'agentId': 'flow', 'name': '窜货识别', 'prompt': '识别跨区域窜货路径、异常低价倾销，标记风险等级', 'retryCount': 2, 'timeout': 30000, 'modelId': 'deepseek-v3', 'triggerCondition': 's1 完成后自动触发'},
                    {'id': 's3', 'agentId': 'ops', 'name': '影响分析', 'prompt': '分析窜货对区域销售的影响，测算损失金额', 'retryCount': 2, 'timeout': 30000, 'modelId': 'qwen-max', 'triggerCondition': 's2 完成后自动触发', 'data_source': 'dashboard'},
                ],
                'edges': [
                    {'from': 's1', 'to': 's2', 'type': 'sequential'},
                    {'from': 's2', 'to': 's3', 'type': 'sequential'},
                ],
                'sort_order': 3,
            },
            {
                'name': '学术推广全流程',
                'description': '学术兔生成内容→跟客兔执行下发→运营兔追踪效果',
                'category': 'preset',
                'tags': ['学术', '推广', '效果追踪'],
                'steps': [
                    {'id': 's1', 'agentId': 'academic', 'name': '内容策划', 'prompt': '根据推广目标与受众，策划学术内容结构与关键信息点', 'retryCount': 2, 'timeout': 30000, 'modelId': 'qwen25-72b', 'triggerCondition': '营销活动启动时手动触发'},
                    {'id': 's2', 'agentId': 'academic', 'name': '生成素材', 'prompt': '生成合规课件、患教资料、推广话术等全链路素材', 'retryCount': 3, 'timeout': 60000, 'modelId': 'qwen25-72b', 'triggerCondition': 's1 完成后自动触发'},
                    {'id': 's3a', 'agentId': 'crm', 'name': '渠道下发', 'prompt': '通过跟客兔将素材下发给目标客户', 'retryCount': 2, 'timeout': 45000, 'modelId': 'hunyuan-pro', 'triggerCondition': 's2 完成后并行触发', 'data_source': 'customer'},
                    {'id': 's3b', 'agentId': 'ops', 'name': '效果追踪', 'prompt': '追踪推广活动数据，分析转化率与 ROI', 'retryCount': 2, 'timeout': 30000, 'modelId': 'qwen-max', 'triggerCondition': 's2 完成后并行触发', 'data_source': 'dashboard'},
                ],
                'edges': [
                    {'from': 's1', 'to': 's2', 'type': 'sequential'},
                    {'from': 's2', 'to': 's3a', 'type': 'parallel'},
                    {'from': 's2', 'to': 's3b', 'type': 'parallel'},
                ],
                'sort_order': 4,
            },
        ]
        for t in templates:
            # 规范化 steps/edges：旧格式自动转为新格式
            t['steps'] = normalize_workflow_steps(t['steps'])
            t['edges'] = normalize_edges(t['edges'])
            WorkflowTemplate.objects.get_or_create(name=t['name'], defaults=t)

    def _create_tenant(self):
        self.tenant, _ = Tenant.objects.get_or_create(
            code='jiuzhoutong',
            defaults={
                'name': '九州通医药集团',
                'platform_name': '九州通医药',
                'enterprise_id': '91420000132268487L',
                'status': 'active'
            }
        )

        # 角色
        roles = [
            {'code': 'admin', 'name': '管理员', 'description': '全部权限', 'views': ['chat', 'office', 'tasks', 'dataBase', 'media', 'knowledge', 'data', 'permissions', 'credits', 'settings'], 'agents': ['control', 'ops', 'crm', 'purchase', 'flow', 'academic'], 'can_manage_members': True, 'can_assign_credits': True},
            {'code': 'procurement_manager', 'name': '采购经理', 'description': '采购智能体 + 数据看板', 'views': ['chat', 'office', 'tasks', 'dataBase', 'data'], 'agents': ['purchase', 'ops', 'flow'], 'can_manage_members': False, 'can_assign_credits': False},
            {'code': 'sales_supervisor', 'name': '销售主管', 'description': '跟客智能体 + 客户管理', 'views': ['chat', 'office', 'tasks', 'dataBase', 'knowledge', 'data'], 'agents': ['crm', 'ops', 'academic'], 'can_manage_members': False, 'can_assign_credits': False},
            {'code': 'member', 'name': '普通成员', 'description': '仅对话工作台', 'views': ['chat'], 'agents': ['crm'], 'can_manage_members': False, 'can_assign_credits': False},
        ]
        for r in roles:
            Role.objects.get_or_create(tenant=self.tenant, code=r['code'], defaults=r)

    def _create_users(self):
        admin_role = Role.objects.get(tenant=self.tenant, code='admin')
        pm_role = Role.objects.get(tenant=self.tenant, code='procurement_manager')
        ss_role = Role.objects.get(tenant=self.tenant, code='sales_supervisor')
        mb_role = Role.objects.get(tenant=self.tenant, code='member')

        users_data = [
            ('chensheng', 'chensheng123', '陈升', admin_role, 5000, 'online', True, '13800000001', 'unlimited', 0),
            ('bill', 'bill123', 'Bill', admin_role, 3000, 'offline', True, '13800000002', 'monthly', 3000),
            ('liprocurement', 'li123', '李采购', pm_role, 2000, 'online', True, '13800000003', 'monthly', 2000),
            ('wangxiaoshou', 'wang123', '王销售', ss_role, 1500, 'offline', True, '13800000004', 'daily', 100),
            ('zhangkehu', 'zhang123', '张客服', mb_role, 500, 'online', True, '13800000005', 'fixed', 500),
            ('liuyunying', 'liu123', '刘运营', mb_role, 500, 'offline', False, '13800000006', 'fixed', 500),
        ]
        for username, password, display_name, role, credits, status, enabled, phone, alloc_type, alloc_value in users_data:
            user, created = User.objects.get_or_create(username=username)
            if created:
                user.set_password(password)
                user.save()
            TenantUser.objects.get_or_create(
                user=user, tenant=self.tenant,
                defaults={
                    'role': role, 'credits': credits, 'status': status, 'enabled': enabled, 'phone': phone,
                    'credit_allocation_type': alloc_type, 'credit_allocation_value': alloc_value,
                }
            )

    def _create_package(self):
        pkg, _ = Package.objects.get_or_create(tenant=self.tenant, defaults={'name': '专业版'})
        quotas = [
            ('procurement', 50000, 12400),
            ('operations', 30000, 5200),
            ('marketing', 30000, 8100),
            ('distribution', 20000, 3600),
            ('academic', 20000, 2100),
        ]
        for agent_code, monthly, used in quotas:
            PackageQuota.objects.get_or_create(package=pkg, agent_code=agent_code, defaults={'monthly': monthly, 'used': used})

    def _create_agent_configs(self):
        configs = [
            ('ops', 'qwen-max', 0.3, 2, 'hunyuan-pro', 0.6),
            ('crm', 'hunyuan-pro', 0.5, 2, 'qwen-max', 0.7),
            ('purchase', 'qwen-max', 0.2, 3, 'deepseek-v3', 0.65),
            ('flow', 'deepseek-v3', 0.2, 2, 'qwen-max', 0.6),
            ('academic', 'qwen25-72b', 0.6, 2, 'qwen-max', 0.75),
        ]
        for aid, mid, temp, retry, fb, ht in configs:
            AgentConfig.objects.get_or_create(
                tenant=self.tenant, agent_id=aid,
                defaults={'model_id': mid, 'temperature': temp, 'max_retry': retry, 'fallback_model_id': fb, 'human_takeover_threshold': ht}
            )

    def _create_dify_config(self):
        dc, _ = DifyConfig.objects.get_or_create(tenant=self.tenant, defaults={'configured': False, 'connection_status': 'disconnected'})
        for code in ['procurement', 'operations', 'marketing', 'distribution', 'academic']:
            DifyWorkflow.objects.get_or_create(
                dify_config=dc, code=code,
                defaults={'agent_code': code, 'api_key': '', 'base_url': 'https://api.dify.ai/v1'}
            )

    def _create_products(self):
        products = [
            ('阿莫西林胶囊', '0.25g*24粒', '盒', '抗生素', 12.50, 3200, '正常'),
            ('布洛芬缓释胶囊', '0.3g*20粒', '盒', '解热镇痛', 18.00, 4500, '正常'),
            ('奥美拉唑肠溶片', '20mg*14片', '盒', '消化系统', 25.00, 800, '库存预警'),
            ('阿托伐他汀钙片', '10mg*7片', '盒', '心血管', 42.00, 2000, '正常'),
            ('盐酸二甲双胍片', '0.5g*20片', '盒', '糖尿病', 8.50, 6000, '正常'),
            ('氯雷他定片', '10mg*6片', '盒', '抗过敏', 15.00, 1200, '正常'),
            ('头孢克肟分散片', '50mg*6片', '盒', '抗生素', 32.00, 300, '库存预警'),
            ('蒙脱石散', '3g*10袋', '盒', '消化系统', 22.00, 2500, '正常'),
        ]
        for name, spec, unit, cat, price, stock, status in products:
            Product.objects.get_or_create(
                tenant=self.tenant, name=name,
                defaults={'spec': spec, 'unit': unit, 'category': cat, 'price': price, 'stock': stock, 'status': status}
            )

    def _create_customers(self):
        customers = [
            ('大药房旗舰店', '连锁药店', '赵总', '13800001111', 85000, 'A'),
            ('健康连锁药店', '连锁药店', '钱经理', '13800002222', 62000, 'A'),
            ('百姓平价大药房', '单体药店', '孙店长', '13800003333', 35000, 'B'),
            ('社区便民诊所', '诊所', '李医生', '13800004444', 18000, 'B'),
            ('仁和堂连锁', '连锁药店', '周采购', '13800005555', 72000, 'A'),
            ('永康大药房', '单体药店', '吴经理', '13800006666', 28000, 'C'),
        ]
        now = timezone.now()
        for i, (name, ctype, contact, phone, mp, level) in enumerate(customers):
            Customer.objects.get_or_create(
                tenant=self.tenant, name=name,
                defaults={
                    'type': ctype, 'contact': contact, 'phone': phone,
                    'monthly_purchase': mp, 'level': level,
                    'last_order': now - timedelta(days=random.randint(1, 15)),
                }
            )

    def _create_orders(self):
        customers = list(Customer.objects.filter(tenant=self.tenant))
        if not customers:
            return
        orders = [
            ('大药房旗舰店', 28500, 4, '已完成'),
            ('健康连锁药店', 15600, 2, '配送中'),
            ('百姓平价大药房', 8900, 1, '待发货'),
            ('仁和堂连锁', 32200, 5, '已完成'),
            ('大药房旗舰店', 12300, 3, '配送中'),
        ]
        now = timezone.now()
        for i, (cname, amt, items, status) in enumerate(orders):
            Order.objects.get_or_create(
                tenant=self.tenant, customer_name=cname, amount=amt, time=now - timedelta(hours=random.randint(1, 72)),
                defaults={'items_count': items, 'status': status}
            )

    def _create_warehouses(self):
        warehouses = [
            ('华北中心仓', '北京'),
            ('华东中心仓', '上海'),
            ('华南中心仓', '广州'),
            ('西南仓', '成都'),
        ]
        for name, location in warehouses:
            Warehouse.objects.get_or_create(tenant=self.tenant, name=name, defaults={'location': location})

    def _create_knowledge(self):
        docs = [
            ('抗生素合理使用指南.pdf', 'PDF', '2.3MB', '医学指南', ['academic'],
             '抗生素合理使用指南：本指南旨在规范抗生素临床使用，涵盖青霉素类、头孢菌素类、大环内酯类等常用抗生素的适应症、用法用量、不良反应及禁忌症。重点关注耐药性监测和分级管理，建议根据药敏试验结果选择抗生素，避免滥用。'),
            ('采购流程SOP.docx', 'DOC', '1.1MB', '管理制度', ['purchase'],
             '采购流程标准操作规程：1.需求申报：各仓库根据库存预警自动生成补货需求。2.供应商比价：至少三家供应商报价，综合价格、交期、资质评分。3.合同签订：法务审核后签订采购合同。4.到货验收：质量部门抽检合格后入库。5.付款结算：按合同账期结算。'),
            ('客户分级管理方案.pptx', 'PPT', '5.2MB', '销售策略', ['crm'],
             '客户分级管理方案：按年采购额和活跃度将客户分为A/B/C三级。A级客户年采购额>100万，月均下单>4次，配备专属客户经理。B级客户年采购额30-100万，月均下单2-4次。C级客户年采购额<30万。对不同级别客户实施差异化拜访频率和促销策略。'),
            ('药品安全库存标准.xlsx', 'XLS', '0.8MB', '数据标准', ['purchase', 'ops'],
             '药品安全库存标准：阿莫西林胶囊最低库存500盒，安全库存1000盒。布洛芬缓释胶囊最低库存300盒，安全库存800盒。头孢克肟片最低库存200盒，安全库存500盒。库存低于最低值自动触发采购预警，低于安全值启动紧急补货流程。'),
            ('GSP合规检查清单.md', 'MD', '0.3MB', '合规文档', ['ops', 'flow'],
             'GSP合规检查清单：药品经营质量管理规范检查要点包括：1.仓储管理：温湿度监控、分区管理、效期管理。2.运输管理：冷链运输、追溯码管理。3.销售管理：处方药销售、流向追溯。4.人员管理：健康档案、培训记录。5.文件管理：制度文件、记录保存。'),
            ('学术推广用词规范.doc', 'DOC', '0.5MB', '学术规范', ['academic'],
             '学术推广用词规范：药品学术推广中严禁使用绝对化用语（如最安全、最有效），不得扩大适应症范围，不得与其他药品做不当对比。推广材料需经医学部审核，确保内容基于循证医学证据。重点药品的学术推广需准备完整的文献支持包。'),
            ('2026年药品集采目录.pdf', 'PDF', '3.1MB', '政策文件', ['purchase'],
             '2026年药品集采目录：国家组织药品集中采购第十批目录，涵盖82种药品，平均降价53%。重点关注品种：阿莫西林胶囊集采价0.35元/粒，布洛芬缓释胶囊集采价0.28元/粒，头孢克肟片集采价0.52元/片。采购周期为12个月。'),
            ('月度经营分析模板.xlsx', 'XLS', '1.5MB', '报表模板', ['ops'],
             '月度经营分析模板：核心指标包括销售额、毛利率、库存周转率、客户活跃度、采购成本占比。分析方法：同比环比分析、趋势分析、ABC分类分析。输出成果：经营月报、异常预警清单、改进建议方案。'),
        ]
        for name, dtype, size, folder, agents, content_text in docs:
            KnowledgeDoc.objects.get_or_create(
                tenant=self.tenant, name=name,
                defaults={'type': dtype, 'size': size, 'folder': folder, 'bound_agents': agents, 'content_text': content_text}
            )

    def _create_media(self):
        assets = [
            ('产品宣传海报-阿莫西林.png', 'image', '2.1MB'),
            ('企业宣传册封面.jpg', 'image', '1.8MB'),
            ('学术会议背景图.png', 'image', '3.5MB'),
            ('药品说明书扫描件.png', 'image', '0.9MB'),
            ('公司LOGO-高清版.png', 'image', '0.5MB'),
            ('员工培训照片.jpg', 'image', '2.8MB'),
        ]
        for name, atype, size in assets:
            MediaAsset.objects.get_or_create(tenant=self.tenant, name=name, defaults={'type': atype, 'size': size})

    def _create_tasks(self):
        tasks = [
            ('每日采购报表', 'purchase', '每天 09:00', True, 'success'),
            ('库存预警检查', 'ops', '每天 08:00', True, 'success'),
            ('客户回访提醒', 'crm', '每周一 10:00', True, 'success'),
            ('流向异常巡检', 'flow', '每天 14:00', True, 'success'),
            ('月度经营报告', 'ops', '每月1日 09:00', True, 'pending'),
        ]
        now = timezone.now()
        for name, agent, schedule, enabled, status in tasks:
            Task.objects.get_or_create(
                tenant=self.tenant, name=name,
                defaults={
                    'agent_code': agent, 'schedule': schedule, 'enabled': enabled,
                    'status': status, 'last_run': now - timedelta(hours=random.randint(1, 24)),
                    'last_result': 'success',
                }
            )

    def _create_skills(self):
        skills = [
            ('智能报价', '自动生成产品报价单', '销售'),
            ('客户画像', '基于交易数据生成客户画像', '销售'),
            ('合同审查', '智能审查采购合同条款', '采购'),
            ('数据分析', '多维度数据分析与可视化', '数据'),
            ('流向地图', '可视化药品流向热力图', '数据'),
            ('学术文章', '自动生成学术推广文章', '学术'),
            ('课件生成', '基于知识库生成培训课件', '学术'),
            ('合规检查', 'GSP合规自动检查', '合规'),
            ('竞品分析', '市场竞品自动分析报告', '市场'),
        ]
        for name, desc, cat in skills:
            Skill.objects.get_or_create(name=name, defaults={'description': desc, 'category': cat})

    def _create_saas(self):
        connections = [
            ('进销存系统', '对接内部进销存管理系统', 'connected', False),
            ('B2B交易平台', '药京采平台数据对接', 'connected', True),
            ('CRM系统', '客户关系管理系统', 'connected', True),
            ('财务系统', '金蝶财务系统对接', 'pending', False),
            ('物流追踪', '快递鸟物流数据接口', 'connected', True),
        ]
        now = timezone.now()
        for name, desc, status, two_way in connections:
            SaaSConnection.objects.get_or_create(
                tenant=self.tenant, name=name,
                defaults={'description': desc, 'status': status, 'two_way': two_way, 'last_sync': now - timedelta(hours=random.randint(1, 12))}
            )

    def _create_connectors(self):
        connectors = [
            ('ERP系统', 'erp', '企业资源计划系统', 'Building2', False, 'disconnected'),
            ('B2B平台', 'b2b', '医药B2B交易平台', 'ShoppingCart', True, 'connected'),
            ('B2C商城', 'b2c', '自营B2C电商平台', 'Store', False, 'disconnected'),
            ('WMS仓储', 'erp', '仓库管理系统', 'Warehouse', True, 'connected'),
            ('物流追踪', 'third-party', '第三方物流数据接入', 'Truck', True, 'connected'),
            ('天猫/京东旗舰店', 'third-party', '电商平台数据接入', 'Globe', False, 'pending'),
            ('POS收银', 'b2c', '门店POS系统', 'CreditCard', False, 'disconnected'),
            ('BI分析', 'third-party', '商业智能分析平台', 'BarChart3', False, 'disconnected'),
            ('SaaS数据底座', 'erp', 'YesGo SaaS数据底座', 'Boxes', True, 'connected'),
        ]
        for name, ctype, desc, icon, enabled, status in connectors:
            DataConnector.objects.get_or_create(
                tenant=self.tenant, name=name,
                defaults={'type': ctype, 'description': desc, 'icon_name': icon, 'enabled': enabled, 'status': status}
            )

    def _create_credit_ledger(self):
        admin_user = User.objects.filter(username='chensheng').first()
        if not admin_user:
            return
        membership = TenantUser.objects.filter(user=admin_user, tenant=self.tenant).first()
        balance = membership.credits if membership else 5000
        entries = [
            ('crm', '跟客智能体', 50, '客户画像分析', balance - 50),
            ('purchase', '采购智能体', 120, '阿莫西林补货方案生成', balance - 170),
            ('ops', '运营智能体', 30, '经营周报生成', balance - 200),
            ('system', '系统充值', -500, '积分充值', balance + 300),
            ('flow', '流向智能体', 80, '窜货预警分析', balance + 220),
        ]
        now = timezone.now()
        for i, (agent_code, agent_name, amount, reason, ba) in enumerate(entries):
            CreditLedger.objects.get_or_create(
                tenant=self.tenant, user=admin_user, reason=reason,
                defaults={'agent_code': agent_code, 'agent_name': agent_name, 'amount': amount, 'balance_after': ba, 'created_at': now - timedelta(hours=i)}
            )

    def _create_prompts(self):
        """首页提示词 + 普通提示词（第二层管理后台可编辑）"""
        home_prompts = [
            # 推荐
            ('home', 'recommend', '平台活动策划', 'megaphone', '根据近一个月平台运营及客户情况，帮我策划平台促销活动', 1),
            ('home', 'recommend', '客户分析', 'users', '分析前100名需要跟进的客户，附入表原因及跟进注意事项', 2),
            ('home', 'recommend', '培训跟进', 'graduation-cap', '分析一下客户及业务员学术学习进度，以及学习后有没有进步', 3),
            ('home', 'recommend', '经营分析', 'bar-chart-3', '根据平台实际运营情况，你认为平台运营需要优化的点有哪些？', 4),
            ('home', 'recommend', '滞销分析', 'trending-down', '分析一下库存量大、销量少存在滞销风险的前100个产品', 5),
            # 平台运营
            ('home', 'platform', '平台活动策划', 'megaphone', '根据近一个月平台运营及客户情况，根据不同客户策划平台促销活动', 1),
            ('home', 'platform', '经营分析', 'bar-chart-3', '根据平台实际运营情况，你认为平台运营需要优化的点有哪些？', 2),
            # 营销跟客
            ('home', 'marketing', '客户分析', 'users', '分析前100名需要跟进的客户，附入表原因及跟进注意事项', 1),
            # 流向管控
            ('home', 'flow', '滞销分析', 'trending-down', '分析一下库存量大、销量少存在滞销风险的前100个产品', 1),
            # 学术培训
            ('home', 'academic', '培训跟进', 'graduation-cap', '分析一下客户及业务员学术学习进度，以及学习后有没有进步', 1),
        ]
        chat_prompts = [
            ('帮我分析本月的销售数据', 1),
            ('帮我写一份客户跟进话术', 2),
            ('推荐几款高利润的控销品种', 3),
            ('生成本周经营分析报告', 4),
            ('总结今天的客户跟进情况', 5),
        ]
        # 采购对话快捷输入：快采 / 集采 / 找品 三库
        purchase_chat_prompts = [
            # 快采
            ('quick', '补货推荐', 'package', '帮我分析最近的销售数据，推荐需要补货的药品清单', 1),
            ('quick', '库存预警', 'truck', '我店里哪些药品库存不足？帮我列出低于安全库存的品种', 2),
            ('quick', '比价查询', 'search', '帮我对比阿莫西林胶囊各供应商的报价和配送时效', 3),
            ('quick', '采购清单', 'file-text', '帮我整理一份本月常用药品采购清单，优先缺货和低价品', 4),
            ('quick', '热销品种', 'bar-chart-3', '帮我查看近期热销药品排行，推荐备货', 5),
            # 集采
            ('collective', '发起集采', 'megaphone', '帮我发起一个阿莫西林胶囊的集采需求，需要100盒', 1),
            ('collective', '查看报价', 'message-circle', '帮我看看最近有哪些集采需求已经收到供应商报价', 2),
            ('collective', '调整数量', 'package', '把刚才集采需求的数量改为200盒', 3),
            ('collective', '邀请供应商', 'users', '帮我邀请更多供应商参与本次集采报价', 4),
            # 找品
            ('search', '找独家品种', 'search', '帮我找一个治疗风湿的独家控销品种，我所在区域可以代理的，利润50%以上', 1),
            ('search', '找低价渠道', 'trending-down', '帮我找阿莫西林胶囊价格最低的供应商', 2),
            ('search', '找新品', 'sparkles', '最近市场上有哪些新上市的热门药品推荐', 3),
            ('search', '找替代品种', 'lightbulb', '头孢克肟缺货，帮我找疗效相近的替代品种', 4),
        ]
        for ptype, category, title, icon, content, sort in home_prompts:
            Prompt.objects.get_or_create(
                prompt_type=ptype, category=category, title=title,
                defaults={'icon': icon, 'content': content, 'enabled': True, 'sort': sort}
            )
        for content, sort in chat_prompts:
            Prompt.objects.get_or_create(
                prompt_type='chat', content=content,
                defaults={'enabled': True, 'sort': sort}
            )
        for category, title, icon, content, sort in purchase_chat_prompts:
            Prompt.objects.update_or_create(
                prompt_type='purchase_chat', category=category, title=title,
                defaults={'icon': icon, 'content': content, 'enabled': True, 'sort': sort}
            )

    def _create_conversation(self):
        admin_user = User.objects.filter(username='chensheng').first()
        if not admin_user:
            return
        now = timezone.now()
        conv, _ = Conversation.objects.get_or_create(
            tenant=self.tenant, user=admin_user,
            title='阿莫西林补货方案咨询',
            defaults={'agent_code': 'purchase', 'message_count': 4}
        )
        Message.objects.get_or_create(
            conversation=conv, role='user', content='阿莫西林胶囊库存不足，需要补货',
            defaults={'created_at': now - timedelta(minutes=30)}
        )
        Message.objects.get_or_create(
            conversation=conv, role='assistant', content='已收到采购需求，正在分析。根据当前库存数据，推荐从国药控股补货，单价7.80元，2天到货。',
            defaults={'agent_code': 'purchase', 'agent_name': '采购智能体', 'created_at': now - timedelta(minutes=29)}
        )
