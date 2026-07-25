"""种子数据管理命令 — python manage.py seed"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import random

from apps.platform.models import (
    Tenant, Role, TenantUser, Package, PackageQuota,
    AgentConfig, DifyConfig, DifyWorkflow, Prompt
)
from apps.tenant_db.models import Product, Customer, Order, Warehouse, InventoryAlert
from apps.tenant_ext.models import KnowledgeDoc, MediaAsset, Task, CreditLedger, Skill, SaaSConnection, DataConnector
from apps.model_gateway.models import AIModel
from apps.chat.models import Conversation, Message


class Command(BaseCommand):
    help = '初始化种子数据（创建默认租户、管理员、业务数据等）'

    def handle(self, *args, **options):
        self.stdout.write('🌱 开始初始化种子数据...')

        self._create_models()
        self._create_tenant()
        self._create_users()
        self._create_package()
        self._create_agent_configs()
        self._create_dify_config()
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

    def _create_tenant(self):
        self.tenant, _ = Tenant.objects.get_or_create(
            code='jiuzhoutong',
            defaults={'name': '九州通医药集团', 'platform_name': '九州通医药', 'status': 'active'}
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
            ('chensheng', 'chensheng123', '陈升', admin_role, 5000, 'online', True),
            ('bill', 'bill123', 'Bill', admin_role, 3000, 'offline', True),
            ('liprocurement', 'li123', '李采购', pm_role, 2000, 'online', True),
            ('wangxiaoshou', 'wang123', '王销售', ss_role, 1500, 'offline', True),
            ('zhangkehu', 'zhang123', '张客服', mb_role, 500, 'online', True),
            ('liuyunying', 'liu123', '刘运营', mb_role, 500, 'offline', False),
        ]
        for username, password, display_name, role, credits, status, enabled in users_data:
            user, created = User.objects.get_or_create(username=username)
            if created:
                user.set_password(password)
                user.save()
            TenantUser.objects.get_or_create(
                user=user, tenant=self.tenant,
                defaults={'role': role, 'credits': credits, 'status': status, 'enabled': enabled}
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
            ('抗生素合理使用指南.pdf', 'PDF', '2.3MB', '医学指南', ['academic']),
            ('采购流程SOP.docx', 'DOC', '1.1MB', '管理制度', ['purchase']),
            ('客户分级管理方案.pptx', 'PPT', '5.2MB', '销售策略', ['crm']),
            ('药品安全库存标准.xlsx', 'XLS', '0.8MB', '数据标准', ['purchase', 'ops']),
            ('GSP合规检查清单.md', 'MD', '0.3MB', '合规文档', ['ops', 'flow']),
            ('学术推广用词规范.doc', 'DOC', '0.5MB', '学术规范', ['academic']),
            ('2026年药品集采目录.pdf', 'PDF', '3.1MB', '政策文件', ['purchase']),
            ('月度经营分析模板.xlsx', 'XLS', '1.5MB', '报表模板', ['ops']),
        ]
        for name, dtype, size, folder, agents in docs:
            KnowledgeDoc.objects.get_or_create(
                tenant=self.tenant, name=name,
                defaults={'type': dtype, 'size': size, 'folder': folder, 'bound_agents': agents}
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
            ('home', 'recommend', '找控销产品', 'search', '帮我找一个治疗风湿独家控销品种，我所在区域可以代理的，利润50%以上', 3),
            ('home', 'recommend', '培训跟进', 'graduation-cap', '分析一下客户及业务员学术学习进度，以及学习后有没有进步', 4),
            ('home', 'recommend', '经营分析', 'bar-chart-3', '根据平台实际运营情况，你认为平台运营需要优化的点有哪些？', 5),
            ('home', 'recommend', '滞销分析', 'trending-down', '分析一下库存量大、销量少存在滞销风险的前100个产品', 6),
            # 平台运营
            ('home', 'platform', '平台活动策划', 'megaphone', '根据近一个月平台运营及客户情况，根据不同客户策划平台促销活动', 1),
            ('home', 'platform', '经营分析', 'bar-chart-3', '根据平台实际运营情况，你认为平台运营需要优化的点有哪些？', 2),
            # 营销跟客
            ('home', 'marketing', '客户分析', 'users', '分析前100名需要跟进的客户，附入表原因及跟进注意事项', 1),
            # 流向管控
            ('home', 'flow', '滞销分析', 'trending-down', '分析一下库存量大、销量少存在滞销风险的前100个产品', 1),
            # 智能采购
            ('home', 'purchase', '找控销产品', 'search', '帮我找一个治疗风湿独家控销品种，我所在区域可以代理的，利润50%以上', 1),
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
