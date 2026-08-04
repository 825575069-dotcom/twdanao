"""生成公共数据库测试数据"""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.public_database.models import (
    Supplier, SupplierQualification, CommissionProtocol,
    PublicProduct, CollectiveBatch, ProcurementQuote,
    ProcurementOrder, OrderItem,
    SupplierDeliveryRule, SupplierAccount,
    CollectivePurchaseAnnouncement, CollectiveParticipation,
)
from apps.platform.models import Tenant


class Command(BaseCommand):
    help = '生成公共数据库测试数据（供应商+产品+佣金协议+资质+配送规则+供应商账号+集采公告）'

    def handle(self, *args, **options):
        self.stdout.write('开始生成公共数据库测试数据...')

        # 清除旧数据
        CollectiveParticipation.objects.all().delete()
        CollectivePurchaseAnnouncement.objects.all().delete()
        SupplierAccount.objects.all().delete()
        SupplierDeliveryRule.objects.all().delete()
        ProcurementOrder.objects.all().delete()
        ProcurementQuote.objects.all().delete()
        CollectiveBatch.objects.all().delete()
        PublicProduct.objects.all().delete()
        SupplierQualification.objects.all().delete()
        CommissionProtocol.objects.all().delete()
        Supplier.objects.all().delete()

        # ========== 供应商 ==========
        suppliers_data = [
            {
                'name': '九州通医药集团',
                'code': 'SUP_JZT',
                'supplier_type': 'saas_platform',
                'enterprise_id': '91420100711925XXXX',
                'contact_name': '张经理',
                'contact_phone': '13800138001',
                'address': '湖北省武汉市东西湖区金银潭大道XX号',
                'province': '湖北',
                'city': '武汉',
                'api_base_url': 'https://erp.jzt.example.com',
                'payment_account_id': 'JZT_PAY_001',
            },
            {
                'name': '国药控股股份有限公司',
                'code': 'SUP_GUOYAO',
                'supplier_type': 'saas_platform',
                'enterprise_id': '91310000710930XXXX',
                'contact_name': '李总监',
                'contact_phone': '13900139002',
                'address': '上海市黄浦区南京东路XX号',
                'province': '上海',
                'city': '上海',
                'api_base_url': 'https://b2b.guoyao.example.com',
                'payment_account_id': 'GY_PAY_002',
            },
            {
                'name': '华润医药商业集团',
                'code': 'SUP_HUARUN',
                'supplier_type': 'independent',
                'enterprise_id': '91440300191736XXXX',
                'contact_name': '王主管',
                'contact_phone': '13700137003',
                'address': '广东省深圳市福田区华强北路XX号',
                'province': '广东',
                'city': '深圳',
                'api_base_url': '',
                'payment_account_id': 'HR_PAY_003',
            },
            {
                'name': '广州医药有限公司',
                'code': 'SUP_GZYY',
                'supplier_type': 'independent',
                'enterprise_id': '91440300219373XXXX',
                'contact_name': '陈经理',
                'contact_phone': '13600136004',
                'address': '广东省广州市越秀区东风东路XX号',
                'province': '广东',
                'city': '广州',
                'api_base_url': '',
                'payment_account_id': 'GZYY_PAY_004',
            },
        ]

        suppliers = []
        for i, data in enumerate(suppliers_data):
            s = Supplier.objects.create(
                **data,
                qualification_status='approved',
                qualification_verified_at=timezone.now(),
                sync_enabled=True,
                enabled=True,
                sort_order=i,
            )
            suppliers.append(s)
            self.stdout.write(f'  供应商: {s.name} ({s.province}{s.city})')

            # 资质文件
            qual_types = [
                ('business_license', '营业执照', f'91420...{s.code}'),
                ('gsp_certificate', 'GSP认证证书', f'GSP-2024-{i+1:03d}'),
                ('drug_license', '药品经营许可证', f'YP-2024-{i+1:03d}'),
            ]
            for qtype, qname, qnum in qual_types:
                SupplierQualification.objects.create(
                    supplier=s,
                    qualification_type=qtype,
                    qualification_name=qname,
                    license_number=qnum,
                    file_url=f'https://example.com/quals/{s.code}_{qtype}.pdf',
                    file_name=f'{s.code}_{qtype}.pdf',
                    verified=True,
                    expiry_date=timezone.now().date() + timedelta(days=365),
                )

            # 佣金协议
            CommissionProtocol.objects.create(
                supplier=s,
                protocol_type='percentage',
                value=Decimal('2.5'),
                min_commission=Decimal('10'),
                effective_from=timezone.now().date(),
                status='active',
                signed_at=timezone.now(),
            )

            # 供应商账号
            account = SupplierAccount(
                supplier=s,
                username=s.code.lower().replace('sup_', ''),
                contact_name=s.contact_name,
                contact_phone=s.contact_phone,
                enabled=True,
            )
            account.set_password('123456')
            account.save()
            self.stdout.write(f'    账号: {account.username} / 123456')

        # ========== 配送规则 ==========
        delivery_rules_data = [
            # 九州通（武汉）→ 各区域配送时效
            (0, '广东', ['广州', '深圳', '珠海', '佛山', '东莞'], 24, 500),
            (0, '上海', ['上海'], 24, 300),
            (0, '湖北', ['武汉'], 12, 200),
            (0, '北京', ['北京'], 36, 500),
            (0, '', [], 48, 200),  # 全国兜底

            # 国药控股（上海）
            (1, '上海', ['上海'], 12, 300),
            (1, '广东', ['广州', '深圳', '珠海', '佛山'], 24, 500),
            (1, '北京', ['北京'], 24, 500),
            (1, '湖北', ['武汉'], 24, 500),
            (1, '', [], 48, 200),

            # 华润医药（深圳）
            (2, '广东', ['广州', '深圳', '珠海', '佛山', '东莞'], 12, 200),
            (2, '上海', ['上海'], 36, 500),
            (2, '', [], 48, 200),

            # 广州医药（广州）
            (3, '广东', ['广州', '深圳', '珠海', '佛山', '东莞'], 6, 100),
            (3, '', [], 48, 300),
        ]

        for sup_idx, prov, cities, hours, min_amt in delivery_rules_data:
            SupplierDeliveryRule.objects.create(
                supplier=suppliers[sup_idx],
                province=prov,
                city=cities,
                delivery_hours=hours,
                min_order_amount=Decimal(str(min_amt)),
                enabled=True,
            )
        self.stdout.write(f'  配送规则: {len(delivery_rules_data)} 条')

        # ========== 产品 ==========
        products_data = [
            # 九州通
            {'supplier_idx': 0, 'name': '阿莫西林胶囊', 'trade_name': '阿莫仙', 'specification': '0.25g*24粒/盒', 'manufacturer': '珠海联邦制药', 'dosage_form': '胶囊剂', 'unit': '盒', 'price': Decimal('12.50'), 'category': '抗生素', 'approval_number': '国药准字H44024129', 'knowledge_graph': '广谱半合成青霉素类抗生素，适用于敏感菌所致的呼吸道、泌尿道、皮肤软组织感染。口服成人每次0.5g，每6-8小时一次。对青霉素过敏者禁用。', 'storage_condition': '遮光，密封保存', 'delivery_areas': '全国配送', 'stock_quantity': 5000},
            {'supplier_idx': 0, 'name': '布洛芬缓释胶囊', 'trade_name': '芬必得', 'specification': '0.3g*20粒/盒', 'manufacturer': '中美天津史克制药', 'dosage_form': '缓释胶囊', 'unit': '盒', 'price': Decimal('23.80'), 'category': '解热镇痛', 'approval_number': '国药准字H10983012', 'knowledge_graph': '非甾体抗炎药，用于缓解轻至中度疼痛及感冒引起的发热。成人每次1粒，每12小时一次。饭后服用。消化道溃疡患者慎用。', 'storage_condition': '遮光，密封保存', 'delivery_areas': '全国配送', 'stock_quantity': 3200},
            {'supplier_idx': 0, 'name': '头孢克肟分散片', 'trade_name': '世福素', 'specification': '0.1g*6片/盒', 'manufacturer': '广州白云山制药', 'dosage_form': '分散片', 'unit': '盒', 'price': Decimal('35.60'), 'category': '抗生素', 'approval_number': '国药准字H20050630', 'knowledge_graph': '第三代头孢菌素，对革兰阴性菌作用强。适用于呼吸道感染、泌尿道感染。成人每次0.1g，每日2次。', 'storage_condition': '遮光，密封保存', 'delivery_areas': '全国配送', 'stock_quantity': 1800},
            {'supplier_idx': 0, 'name': '奥美拉唑肠溶胶囊', 'trade_name': '洛赛克', 'specification': '20mg*14粒/盒', 'manufacturer': '阿斯利康制药', 'dosage_form': '肠溶胶囊', 'unit': '盒', 'price': Decimal('68.00'), 'category': '消化系统', 'approval_number': '国药准字H20033394', 'knowledge_graph': '质子泵抑制剂，抑制胃酸分泌。用于胃溃疡、十二指肠溃疡、反流性食管炎。每日晨起空腹服用1粒。', 'storage_condition': '遮光，密封，25C以下保存', 'delivery_areas': '全国配送', 'stock_quantity': 1200},
            {'supplier_idx': 0, 'name': '硝苯地平控释片', 'trade_name': '拜新同', 'specification': '30mg*7片/盒', 'manufacturer': '拜耳医药保健', 'dosage_form': '控释片', 'unit': '盒', 'price': Decimal('42.30'), 'category': '心血管', 'approval_number': '国药准字J20040031', 'knowledge_graph': '钙通道阻滞剂，用于高血压、心绞痛。每日1次，每次1片。整片吞服，不可嚼碎。', 'storage_condition': '遮光，密封保存', 'delivery_areas': '全国配送', 'stock_quantity': 2200},

            # 国药控股
            {'supplier_idx': 1, 'name': '复方丹参滴丸', 'trade_name': '天士力', 'specification': '27mg*150丸/瓶', 'manufacturer': '天士力制药集团', 'dosage_form': '滴丸', 'unit': '瓶', 'price': Decimal('28.50'), 'category': '心血管', 'approval_number': '国药准字Z10950111', 'knowledge_graph': '活血化瘀，理气止痛。用于胸中憋闷，心绞痛。口服或舌下含服，每次10丸，每日3次。', 'storage_condition': '密封保存', 'delivery_areas': '全国配送', 'stock_quantity': 4000},
            {'supplier_idx': 1, 'name': '连花清瘟胶囊', 'trade_name': '以岭', 'specification': '0.35g*24粒/盒', 'manufacturer': '以岭药业股份', 'dosage_form': '胶囊', 'unit': '盒', 'price': Decimal('15.90'), 'category': '感冒用药', 'approval_number': '国药准字Z20040063', 'knowledge_graph': '清瘟解毒，宣肺泄热。用于治疗流行性感冒属热毒袭肺证。每次4粒，每日3次。', 'storage_condition': '密封保存', 'delivery_areas': '全国配送', 'stock_quantity': 8000},
            {'supplier_idx': 1, 'name': '二甲双胍缓释片', 'trade_name': '格华止', 'specification': '0.5g*30片/盒', 'manufacturer': '中美上海施贵宝', 'dosage_form': '缓释片', 'unit': '盒', 'price': Decimal('32.00'), 'category': '糖尿病', 'approval_number': '国药准字H20023370', 'knowledge_graph': '双胍类降糖药，用于2型糖尿病。每日1次，每次1片，晚餐时服用。肾功能不全者禁用。', 'storage_condition': '遮光，密封保存', 'delivery_areas': '全国配送', 'stock_quantity': 3500},
            {'supplier_idx': 1, 'name': '氯吡格雷片', 'trade_name': '波立维', 'specification': '75mg*7片/盒', 'manufacturer': '赛诺菲制药', 'dosage_form': '片剂', 'unit': '盒', 'price': Decimal('89.50'), 'category': '心血管', 'approval_number': '国药准字J20130083', 'knowledge_graph': '抗血小板聚集药，预防动脉粥样硬化血栓形成。每日1次，每次1片。活动性出血禁用。', 'storage_condition': '遮光，密封保存', 'delivery_areas': '全国配送', 'stock_quantity': 900},

            # 华润医药
            {'supplier_idx': 2, 'name': '藿香正气口服液', 'trade_name': '太极', 'specification': '10ml*10支/盒', 'manufacturer': '太极集团涪陵制药', 'dosage_form': '口服液', 'unit': '盒', 'price': Decimal('18.00'), 'category': '感冒用药', 'approval_number': '国药准字Z50020409', 'knowledge_graph': '解表化湿，理气和中。用于外感风寒、内伤湿滞。每次1支，每日2次。', 'storage_condition': '密封，置阴凉处', 'delivery_areas': '华南地区', 'stock_quantity': 6000},
            {'supplier_idx': 2, 'name': '六味地黄丸', 'trade_name': '仲景', 'specification': '200丸/瓶', 'manufacturer': '宛西制药股份', 'dosage_form': '浓缩丸', 'unit': '瓶', 'price': Decimal('25.60'), 'category': '补益用药', 'approval_number': '国药准字Z41022128', 'knowledge_graph': '滋阴补肾。用于肾阴亏损，头晕耳鸣，腰膝酸软。每次8丸，每日3次。', 'storage_condition': '密封保存', 'delivery_areas': '华南地区', 'stock_quantity': 4500},
            {'supplier_idx': 2, 'name': '蒙脱石散', 'trade_name': '思密达', 'specification': '3g*15袋/盒', 'manufacturer': '博福-益普生制药', 'dosage_form': '散剂', 'unit': '盒', 'price': Decimal('38.20'), 'category': '消化系统', 'approval_number': '国药准字H20000690', 'knowledge_graph': '用于成人及儿童急慢性腹泻。每次1袋，每日3次。倒入50ml温水中搅匀服用。', 'storage_condition': '密封保存', 'delivery_areas': '华南地区', 'stock_quantity': 2800},

            # 广州医药
            {'supplier_idx': 3, 'name': '板蓝根颗粒', 'trade_name': '白云山', 'specification': '10g*20袋/包', 'manufacturer': '广州白云山和记黄埔', 'dosage_form': '颗粒剂', 'unit': '包', 'price': Decimal('16.80'), 'category': '感冒用药', 'approval_number': '国药准字Z44023594', 'knowledge_graph': '清热解毒，凉血利咽。用于肺胃热盛所致的咽喉肿痛、口咽干燥。每次1袋，每日3次。', 'storage_condition': '密封保存', 'delivery_areas': '华南地区', 'stock_quantity': 7000},
            {'supplier_idx': 3, 'name': '夏桑菊颗粒', 'trade_name': '星群', 'specification': '10g*10袋/包', 'manufacturer': '广州星群药业', 'dosage_form': '颗粒剂', 'unit': '包', 'price': Decimal('14.50'), 'category': '感冒用药', 'approval_number': '国药准字Z44022229', 'knowledge_graph': '清肝明目，疏风散热，除湿痹。用于风热感冒，目赤头痛。每次1袋，每日3次。', 'storage_condition': '密封保存', 'delivery_areas': '华南地区', 'stock_quantity': 5000},
            {'supplier_idx': 3, 'name': '抗病毒口服液', 'trade_name': '香雪', 'specification': '10ml*12支/盒', 'manufacturer': '广州市香雪制药', 'dosage_form': '口服液', 'unit': '盒', 'price': Decimal('22.00'), 'category': '感冒用药', 'approval_number': '国药准字Z10880006', 'knowledge_graph': '清热祛湿，凉血解毒。用于风热感冒，温病发热。每次1支，每日3次。', 'storage_condition': '密封，置阴凉处', 'delivery_areas': '华南地区', 'stock_quantity': 3500},
        ]

        products = []
        for p_data in products_data:
            supplier = suppliers[p_data.pop('supplier_idx')]
            p = PublicProduct.objects.create(
                supplier=supplier,
                **p_data,
                min_order_quantity=1,
                delivery_info=f'由{supplier.name}统一配送，支持冷链运输',
                status='active',
            )
            products.append(p)

        self.stdout.write(f'  产品: {len(products_data)} 个（含库存数量）')

        # ========== 更新租户位置 ==========
        tenants = Tenant.objects.all()
        tenant_location_map = {
            0: ('广东', '广州', '广东省广州市天河区体育西路XX号'),
            1: ('广东', '深圳', '广东省深圳市南山区科技园XX号'),
            2: ('上海', '上海', '上海市浦东新区张江高科技园区XX号'),
        }
        for idx, tenant in enumerate(tenants):
            prov, city, addr = tenant_location_map.get(idx, ('广东', '广州', ''))
            tenant.province = prov
            tenant.city = city
            if not tenant.address:
                tenant.address = addr
            tenant.save(update_fields=['province', 'city', 'address'])
            self.stdout.write(f'  租户位置: {tenant.name} → {prov}{city}')

        # ========== 测试集采公告 ==========
        announcement = CollectivePurchaseAnnouncement.objects.create(
            title='2026年7月华南地区药品集采',
            description='面向华南地区租户的集中采购，涵盖抗生素、解热镇痛、心血管类药品。参与集采可享受批量优惠价格。',
            announce_time=timezone.now() - timedelta(hours=2),
            quote_deadline=timezone.now() + timedelta(days=1),
            order_deadline=timezone.now() + timedelta(days=3),
            status='announced',
            product_keywords='阿莫西林,布洛芬,连花清瘟,复方丹参',
        )
        self.stdout.write(f'  集采公告: {announcement.title}')

        # 创建集采参与记录（模拟多个租户参与）
        if tenants.exists():
            tenant = tenants.first()
            # 为前3个产品创建参与记录
            for p in products[:3]:
                CollectiveParticipation.objects.create(
                    announcement=announcement,
                    tenant=tenant,
                    product=p,
                    supplier=p.supplier,
                    quantity=50,
                    status='registered',
                )
            self.stdout.write(f'  集采参与: 3 条（{tenant.name}）')

        # ========== 测试报价+订单流程 ==========
        tenant = tenants.first()
        if tenant:
            product = products[0]
            # 快采报价
            from apps.public_database.services.procurement import create_quick_quote, create_order
            quote = create_quick_quote(tenant.id, product.id, 10, agent_id='procurement_agent')
            order = create_order(quote.id, payment_method='wechat')
            self.stdout.write(f'  测试订单: {order.order_number}')

        self.stdout.write(self.style.SUCCESS(f'\n测试数据生成完成!'))
        self.stdout.write(f'  供应商: {Supplier.objects.count()} 个')
        self.stdout.write(f'  产品: {PublicProduct.objects.count()} 个')
        self.stdout.write(f'  配送规则: {SupplierDeliveryRule.objects.count()} 条')
        self.stdout.write(f'  供应商账号: {SupplierAccount.objects.count()} 个')
        self.stdout.write(f'  集采公告: {CollectivePurchaseAnnouncement.objects.count()} 个')
        self.stdout.write(f'  集采参与: {CollectiveParticipation.objects.count()} 条')
        self.stdout.write(f'  资质: {SupplierQualification.objects.count()} 个')
        self.stdout.write(f'  佣金协议: {CommissionProtocol.objects.count()} 个')
        self.stdout.write(f'  订单: {ProcurementOrder.objects.count()} 个')
