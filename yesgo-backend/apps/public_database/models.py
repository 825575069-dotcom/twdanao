from django.db import models


class Supplier(models.Model):
    """供应商"""
    SUPPLIER_TYPE_CHOICES = [
        ('saas_platform', 'SaaS平台'),
        ('independent', '独立供应商'),
    ]
    QUALIFICATION_STATUS_CHOICES = [
        ('pending', '待审核'),
        ('approved', '已通过'),
        ('rejected', '已驳回'),
    ]

    name = models.CharField(max_length=200, verbose_name='供应商名称')
    code = models.CharField(max_length=50, unique=True, verbose_name='供应商编码')
    supplier_type = models.CharField(max_length=20, choices=SUPPLIER_TYPE_CHOICES, default='independent', verbose_name='供应商类型')
    enterprise_id = models.CharField(max_length=100, blank=True, default='', verbose_name='统一社会信用代码')
    contact_name = models.CharField(max_length=100, blank=True, default='', verbose_name='联系人')
    contact_phone = models.CharField(max_length=50, blank=True, default='', verbose_name='联系电话')
    contact_email = models.EmailField(blank=True, default='', verbose_name='联系邮箱')
    address = models.TextField(blank=True, default='', verbose_name='地址')
    province = models.CharField(max_length=50, blank=True, default='', verbose_name='所在省份')
    city = models.CharField(max_length=50, blank=True, default='', verbose_name='所在城市')

    # SaaS 平台收款账户
    payment_account_id = models.CharField(max_length=100, blank=True, default='', verbose_name='平台收款账户ID')

    # 产品同步 API
    api_base_url = models.URLField(blank=True, default='', verbose_name='产品同步API地址')
    api_token = models.CharField(max_length=500, blank=True, default='', verbose_name='API Token')
    sync_enabled = models.BooleanField(default=True, verbose_name='是否启用同步')
    last_synced_at = models.DateTimeField(null=True, blank=True, verbose_name='上次同步时间')

    # 资质审核
    qualification_status = models.CharField(max_length=20, choices=QUALIFICATION_STATUS_CHOICES, default='pending', verbose_name='资质审核状态')
    qualification_verified_at = models.DateTimeField(null=True, blank=True, verbose_name='资质审核时间')
    qualification_remark = models.TextField(blank=True, default='', verbose_name='审核备注')

    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_supplier'
        verbose_name = '供应商'
        verbose_name_plural = verbose_name
        ordering = ['sort_order', '-created_at']

    def __str__(self):
        return self.name


class CommissionProtocol(models.Model):
    """佣金协议"""
    PROTOCOL_TYPE_CHOICES = [
        ('percentage', '比例抽成'),
        ('fixed', '固定佣金'),
    ]
    STATUS_CHOICES = [
        ('active', '生效中'),
        ('expired', '已过期'),
        ('terminated', '已终止'),
    ]

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='commission_protocols', verbose_name='供应商')
    protocol_type = models.CharField(max_length=20, choices=PROTOCOL_TYPE_CHOICES, verbose_name='佣金类型')
    value = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='佣金值(百分比或固定金额)')
    min_commission = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='最低佣金')
    effective_from = models.DateField(verbose_name='生效日期')
    effective_until = models.DateField(null=True, blank=True, verbose_name='到期日期')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='状态')
    signed_at = models.DateTimeField(null=True, blank=True, verbose_name='签署时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_commission_protocol'
        verbose_name = '佣金协议'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.supplier.name} - {self.get_protocol_type_display()}'


class SupplierQualification(models.Model):
    """供应商资质文件"""
    QUALIFICATION_TYPE_CHOICES = [
        ('business_license', '营业执照'),
        ('gsp_certificate', 'GSP认证证书'),
        ('drug_license', '药品经营许可证'),
        ('medical_device_license', '医疗器械经营许可证'),
        ('food_license', '食品经营许可证'),
        ('pharmaceutical_production_license', '药品生产许可证'),
        ('import_drug_license', '进口药品注册证'),
        ('other', '其他'),
    ]

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='qualifications', verbose_name='供应商')
    qualification_type = models.CharField(max_length=50, choices=QUALIFICATION_TYPE_CHOICES, verbose_name='资质类型')
    qualification_name = models.CharField(max_length=200, verbose_name='资质名称')
    file_url = models.URLField(max_length=500, blank=True, default='', verbose_name='文件URL')
    file_name = models.CharField(max_length=200, blank=True, default='', verbose_name='文件名')
    license_number = models.CharField(max_length=100, blank=True, default='', verbose_name='证书编号')
    issue_date = models.DateField(null=True, blank=True, verbose_name='发证日期')
    expiry_date = models.DateField(null=True, blank=True, verbose_name='到期日期')
    verified = models.BooleanField(default=False, verbose_name='是否已验证')
    file_size = models.BigIntegerField(default=0, verbose_name='文件大小(字节)')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_supplier_qualification'
        verbose_name = '供应商资质'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.supplier.name} - {self.get_qualification_type_display()}'


class TenantQualification(models.Model):
    """租户资质文件 — 租户上传的企业资质，用于首营资料交换"""
    QUALIFICATION_TYPE_CHOICES = [
        ('business_license', '营业执照'),
        ('gsp_certificate', 'GSP认证证书'),
        ('drug_license', '药品经营许可证'),
        ('medical_device_license', '医疗器械经营许可证'),
        ('food_license', '食品经营许可证'),
        ('pharmaceutical_production_license', '药品生产许可证'),
        ('import_drug_license', '进口药品注册证'),
        ('other', '其他'),
    ]
    STATUS_CHOICES = [
        ('valid', '有效'),
        ('expiring', '即将到期'),
        ('expired', '已过期'),
    ]

    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='qualifications', verbose_name='租户')
    qualification_type = models.CharField(max_length=50, choices=QUALIFICATION_TYPE_CHOICES, verbose_name='资质类型')
    qualification_name = models.CharField(max_length=200, verbose_name='资质名称')
    file_url = models.URLField(max_length=500, blank=True, default='', verbose_name='文件URL')
    file_name = models.CharField(max_length=200, blank=True, default='', verbose_name='文件名')
    license_number = models.CharField(max_length=100, blank=True, default='', verbose_name='证书编号')
    issue_date = models.DateField(null=True, blank=True, verbose_name='发证日期')
    expiry_date = models.DateField(null=True, blank=True, verbose_name='到期日期')
    verified = models.BooleanField(default=False, verbose_name='是否已验证')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='valid', verbose_name='状态')
    file_size = models.BigIntegerField(default=0, verbose_name='文件大小(字节)')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_tenant_qualification'
        verbose_name = '租户资质'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['expiry_date']),
        ]

    def __str__(self):
        return f'{self.tenant.name} - {self.get_qualification_type_display()}'


class FirstOperationRecord(models.Model):
    """首营记录 — 买方租户与卖方供应商首次合作时的资质互换与签章记录

    独立于订单存在。一次签章完成后，在有效期内可被后续多个订单的资质交换引用复用。
    审核机制：双方互验（无需平台审核），交换后各自确认对方资质。
    """
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('submitted', '已提交'),
        ('exchanged', '资质已互换'),
        ('signing', '签章中'),
        ('signed', '已签章'),
        ('rejected', '已拒绝'),
        ('expired', '已过期'),
    ]

    record_number = models.CharField(max_length=50, unique=True, verbose_name='首营编号')
    buyer_tenant = models.ForeignKey(
        'platform.Tenant', on_delete=models.CASCADE,
        related_name='first_operations_as_buyer', verbose_name='买方租户'
    )
    seller_supplier = models.ForeignKey(
        Supplier, on_delete=models.CASCADE,
        related_name='first_operations_as_seller', verbose_name='卖方供应商'
    )

    # 资质快照（JSON 数组，保存交换时刻的资质文件信息）
    buyer_qualifications = models.JSONField(default=list, blank=True, verbose_name='买方资质快照')
    seller_qualifications = models.JSONField(default=list, blank=True, verbose_name='卖方资质快照')

    # 双方互验确认
    buyer_confirmed = models.BooleanField(default=False, verbose_name='买方已确认')
    buyer_confirmed_at = models.DateTimeField(null=True, blank=True, verbose_name='买方确认时间')
    seller_confirmed = models.BooleanField(default=False, verbose_name='卖方已确认')
    seller_confirmed_at = models.DateTimeField(null=True, blank=True, verbose_name='卖方确认时间')
    buyer_remark = models.TextField(blank=True, default='', verbose_name='买方备注')
    seller_remark = models.TextField(blank=True, default='', verbose_name='卖方备注')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='状态')

    # 电子签章
    e_signature_service = models.CharField(max_length=50, blank=True, default='', verbose_name='签章服务商')
    e_signature_contract_id = models.CharField(max_length=200, blank=True, default='', verbose_name='签章合同ID')
    e_signature_signed_at = models.DateTimeField(null=True, blank=True, verbose_name='签章时间')
    e_signature_contract_url = models.URLField(max_length=500, blank=True, default='', verbose_name='签章合同下载URL')

    # 有效期（签章完成后生效，默认1年）
    valid_from = models.DateField(null=True, blank=True, verbose_name='生效日期')
    valid_until = models.DateField(null=True, blank=True, verbose_name='到期日期')

    # 外部复用标记 — 如果供应商已与该租户（通过统一社会信用代码识别）建立过首营资料，
    # 则采购方无需重复交换，直接复用供应商系统的记录
    external_reused = models.BooleanField(default=False, verbose_name='是否外部复用')
    external_source = models.CharField(max_length=200, blank=True, default='', verbose_name='外部复用来源',
        help_text='记录复用来源，如供应商API地址')

    created_by = models.CharField(max_length=100, blank=True, default='', verbose_name='发起人')
    notes = models.TextField(blank=True, default='', verbose_name='备注')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_first_operation_record'
        verbose_name = '首营记录'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['buyer_tenant', 'status']),
            models.Index(fields=['seller_supplier', 'status']),
            models.Index(fields=['valid_until']),
            models.Index(fields=['external_reused']),
        ]

    def __str__(self):
        return f'{self.record_number} - {self.buyer_tenant.name} ↔ {self.seller_supplier.name}'

    @property
    def is_valid(self):
        """首营记录是否在有效期内"""
        from datetime import date
        if self.status != 'signed':
            return False
        if not self.valid_until:
            return False
        return date.today() <= self.valid_until


class PublicProduct(models.Model):
    """公共产品"""
    STATUS_CHOICES = [
        ('active', '在售'),
        ('inactive', '停售'),
        ('out_of_stock', '缺货'),
    ]

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='products', verbose_name='供应商')
    product_code = models.CharField(max_length=100, blank=True, default='', verbose_name='产品编码')
    name = models.CharField(max_length=200, verbose_name='通用名')
    trade_name = models.CharField(max_length=200, blank=True, default='', verbose_name='商品名')
    specification = models.CharField(max_length=200, blank=True, default='', verbose_name='包装规格')
    manufacturer = models.CharField(max_length=200, blank=True, default='', verbose_name='厂家')
    dosage_form = models.CharField(max_length=100, blank=True, default='', verbose_name='剂型')
    unit = models.CharField(max_length=50, blank=True, default='', verbose_name='单位')
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='价格')
    min_order_quantity = models.IntegerField(default=1, verbose_name='最小起订量')
    category = models.CharField(max_length=100, blank=True, default='', verbose_name='分类')
    approval_number = models.CharField(max_length=100, blank=True, default='', verbose_name='批准文号')
    barcode = models.CharField(max_length=100, blank=True, default='', verbose_name='条形码')

    # 知识图谱 / 备注（供智能体搜索用）
    knowledge_graph = models.TextField(blank=True, default='', verbose_name='产品知识图谱')

    # 说明书
    manual_url = models.URLField(max_length=500, blank=True, default='', verbose_name='说明书URL')
    manual_text = models.TextField(blank=True, default='', verbose_name='说明书文本')

    # 可销设置（智能体按租户区域+渠道匹配产品，命中的才能推送报价）
    sales_regions = models.JSONField(default=list, verbose_name='可销区域',
        help_text='可销省/市列表，如 [{"province":"广东","cities":["广州","深圳"]}]，空列表=全国')
    sales_channels = models.JSONField(default=list, verbose_name='可销渠道',
        help_text='可销渠道类型，如["诊所","药店","医院"]，空列表=全渠道')

    # 配送信息
    delivery_info = models.TextField(blank=True, default='', verbose_name='配送信息')
    storage_condition = models.CharField(max_length=200, blank=True, default='', verbose_name='储存条件')
    delivery_areas = models.TextField(blank=True, default='', verbose_name='配送区域')

    # 产品图片
    image_url = models.URLField(max_length=500, blank=True, default='', verbose_name='产品图片URL')

    # 搜索向量缓存（后续可接入向量数据库）
    search_vector = models.TextField(blank=True, default='', verbose_name='搜索向量文本')

    # 库存
    stock_quantity = models.IntegerField(default=0, verbose_name='库存数量')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='状态')
    last_synced_at = models.DateTimeField(null=True, blank=True, verbose_name='上次同步时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_product'
        verbose_name = '公共产品'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['manufacturer']),
            models.Index(fields=['supplier']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'{self.name} {self.specification}'


class CollectiveBatch(models.Model):
    """集采批次"""
    STATUS_CHOICES = [
        ('collecting', '收集中'),
        ('notifying_supplier', '已通知供应商'),
        ('quoted', '供应商已报价'),
        ('distributed', '已分发报价'),
        ('closed', '已关闭'),
    ]
    NOTIFY_METHOD_CHOICES = [
        ('api', 'API通知'),
        ('third_layer', '第三层系统通知'),
    ]

    batch_date = models.DateField(verbose_name='集采日期')
    product = models.ForeignKey(PublicProduct, on_delete=models.CASCADE, related_name='collective_batches', verbose_name='产品')
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='collective_batches', verbose_name='供应商')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='collecting', verbose_name='状态')
    total_quantity = models.IntegerField(default=0, verbose_name='汇总需求量')
    quoted_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name='供应商报价')
    quoted_at = models.DateTimeField(null=True, blank=True, verbose_name='报价时间')
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name='报价截止时间')
    notify_method = models.CharField(max_length=20, choices=NOTIFY_METHOD_CHOICES, default='api', verbose_name='通知方式')
    notes = models.TextField(blank=True, default='', verbose_name='备注')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_collective_batch'
        verbose_name = '集采批次'
        verbose_name_plural = verbose_name
        ordering = ['-batch_date', '-created_at']

    def __str__(self):
        return f'{self.batch_date} - {self.product.name}'


class ProcurementQuote(models.Model):
    """采购报价请求"""
    QUOTE_TYPE_CHOICES = [
        ('quick', '快采'),
        ('collective', '集采'),
    ]
    STATUS_CHOICES = [
        ('pending', '待报价'),
        ('quoted', '已报价'),
        ('accepted', '已接受'),
        ('rejected', '已拒绝'),
        ('expired', '已过期'),
        ('ordered', '已下单'),
    ]

    quote_type = models.CharField(max_length=20, choices=QUOTE_TYPE_CHOICES, verbose_name='报价类型')
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='procurement_quotes', verbose_name='租户')
    product = models.ForeignKey(PublicProduct, on_delete=models.CASCADE, related_name='quotes', verbose_name='产品')
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='quotes', verbose_name='供应商')
    collective_batch = models.ForeignKey(CollectiveBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name='quotes', verbose_name='集采批次')
    agent_id = models.CharField(max_length=100, blank=True, default='', verbose_name='发起智能体ID')

    quantity = models.IntegerField(default=1, verbose_name='需求量')
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name='报价单价')
    total_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True, verbose_name='报价总价')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    notes = models.TextField(blank=True, default='', verbose_name='备注')
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name='报价有效期')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_procurement_quote'
        verbose_name = '采购报价'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_quote_type_display()} - {self.product.name} x{self.quantity}'


class ProcurementOrder(models.Model):
    """采购订单（提单）"""
    ORDER_TYPE_CHOICES = [
        ('quick', '快采'),
        ('collective', '集采'),
    ]
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('submitted', '已提交'),
        ('qualifying', '资质交换中'),
        ('qualified', '资质已交换'),
        ('paying', '待支付'),
        ('paid', '已支付'),
        ('splitting', '分账中'),
        ('split', '已分账'),
        ('delivering', '配送中'),
        ('completed', '已完成'),
        ('cancelled', '已取消'),
        ('refunded', '已退款'),
    ]
    PAYMENT_METHOD_CHOICES = [
        ('wechat', '微信支付'),
        ('alipay', '支付宝'),
        ('credit', '账期支付'),
    ]
    PAYMENT_STATUS_CHOICES = [
        ('unpaid', '未支付'),
        ('paid', '已支付'),
        ('refunding', '退款中'),
        ('refunded', '已退款'),
    ]

    order_number = models.CharField(max_length=50, unique=True, verbose_name='订单编号')
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='procurement_orders', verbose_name='买方租户')
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='orders', verbose_name='卖方供应商')
    quote = models.ForeignKey(ProcurementQuote, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders', verbose_name='关联报价')
    order_type = models.CharField(max_length=20, choices=ORDER_TYPE_CHOICES, default='quick', verbose_name='订单类型')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='订单状态')
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name='订单总额')
    commission_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name='佣金金额')
    supplier_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name='供应商应得金额')

    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, blank=True, default='', verbose_name='支付方式')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='unpaid', verbose_name='支付状态')

    # 回传供应商系统
    supplier_order_id = models.CharField(max_length=100, blank=True, default='', verbose_name='供应商系统订单号')
    supplier_order_synced = models.BooleanField(default=False, verbose_name='是否已同步供应商系统')

    # 资质交换
    qualification_exchange_status = models.CharField(max_length=20, blank=True, default='pending', verbose_name='资质交换状态')

    # 电子签章（预留接口）
    e_signature_status = models.CharField(max_length=20, blank=True, default='none', verbose_name='电子签章状态')
    e_signature_contract_id = models.CharField(max_length=200, blank=True, default='', verbose_name='签章合同ID')

    # 物流
    tracking_number = models.CharField(max_length=200, blank=True, default='', verbose_name='物流单号')

    notes = models.TextField(blank=True, default='', verbose_name='备注')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_procurement_order'
        verbose_name = '采购订单'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return self.order_number


class OrderItem(models.Model):
    """订单明细"""
    order = models.ForeignKey(ProcurementOrder, on_delete=models.CASCADE, related_name='items', verbose_name='订单')
    product = models.ForeignKey(PublicProduct, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='产品')
    product_name = models.CharField(max_length=200, verbose_name='产品名称(快照)')
    product_spec = models.CharField(max_length=200, blank=True, default='', verbose_name='规格(快照)')
    product_manufacturer = models.CharField(max_length=200, blank=True, default='', verbose_name='厂家(快照)')
    product_unit = models.CharField(max_length=50, blank=True, default='', verbose_name='单位(快照)')
    quantity = models.IntegerField(default=1, verbose_name='数量')
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='单价')
    total_price = models.DecimalField(max_digits=14, decimal_places=2, verbose_name='小计')

    class Meta:
        db_table = 'pdb_order_item'
        verbose_name = '订单明细'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.product_name} x{self.quantity}'


class QualificationExchange(models.Model):
    """资质交换记录"""
    STATUS_CHOICES = [
        ('pending', '待交换'),
        ('exchanged', '已交换'),
        ('signing', '签章中'),
        ('signed', '已签章'),
        ('expired', '已过期'),
    ]

    order = models.OneToOneField(ProcurementOrder, on_delete=models.CASCADE, related_name='qualification_exchange', verbose_name='订单')
    first_operation = models.ForeignKey(
        FirstOperationRecord, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='order_exchanges', verbose_name='关联首营记录'
    )
    buyer_qualifications = models.JSONField(default=list, blank=True, verbose_name='买方资质文件')
    seller_qualifications = models.JSONField(default=list, blank=True, verbose_name='卖方资质文件')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')

    # 电子签章（预留接口）
    e_signature_service = models.CharField(max_length=50, blank=True, default='', verbose_name='签章服务商')
    e_signature_contract_id = models.CharField(max_length=200, blank=True, default='', verbose_name='签章合同ID')
    e_signature_signed_at = models.DateTimeField(null=True, blank=True, verbose_name='签章时间')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_qualification_exchange'
        verbose_name = '资质交换'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'资质交换 - {self.order.order_number}'


class PaymentRecord(models.Model):
    """支付记录"""
    STATUS_CHOICES = [
        ('pending', '待支付'),
        ('paid', '已支付'),
        ('splitting', '分账中'),
        ('split', '已分账'),
        ('refunding', '退款中'),
        ('refunded', '已退款'),
        ('failed', '支付失败'),
    ]

    order = models.ForeignKey(ProcurementOrder, on_delete=models.CASCADE, related_name='payments', verbose_name='订单')
    payment_method = models.CharField(max_length=20, choices=ProcurementOrder.PAYMENT_METHOD_CHOICES, verbose_name='支付方式')
    amount = models.DecimalField(max_digits=14, decimal_places=2, verbose_name='支付金额')
    commission_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name='佣金金额')
    supplier_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name='供应商应得金额')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')

    # 聚合支付渠道（预留接口）
    channel = models.CharField(max_length=50, blank=True, default='', verbose_name='支付渠道')
    channel_transaction_id = models.CharField(max_length=200, blank=True, default='', verbose_name='渠道交易号')
    channel_split_id = models.CharField(max_length=200, blank=True, default='', verbose_name='分账单号')

    paid_at = models.DateTimeField(null=True, blank=True, verbose_name='支付时间')
    split_at = models.DateTimeField(null=True, blank=True, verbose_name='分账时间')
    error_message = models.TextField(blank=True, default='', verbose_name='错误信息')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_payment_record'
        verbose_name = '支付记录'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'支付 - {self.order.order_number} - {self.amount}'


class SupplierDeliveryRule(models.Model):
    """供应商配送规则 — 按区域配置配送时长与起订金额"""
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='delivery_rules', verbose_name='供应商')
    province = models.CharField(max_length=50, blank=True, default='', verbose_name='省份（空=全国）')
    city = models.JSONField(default=list, verbose_name='城市列表（空=全省）',
                            help_text='配送城市列表，如["广州","深圳"]；空列表表示该省全部城市')
    delivery_hours = models.IntegerField(default=48, verbose_name='配送时长（小时）')
    min_order_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='起订金额')
    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_supplier_delivery_rule'
        verbose_name = '供应商配送规则'
        verbose_name_plural = verbose_name
        ordering = ['supplier', 'province']
        unique_together = [('supplier', 'province')]

    def __str__(self):
        cities = self.city or []
        if self.province:
            region = f'{self.province}' if not cities else f'{self.province}（{"、".join(cities)}）'
        else:
            region = '全国'
        return f'{self.supplier.name} → {region} ({self.delivery_hours}h)'


class CollectivePurchaseAnnouncement(models.Model):
    """集采公告 — 平台管理员发起集采，含公告时间、报价截止、下单截止"""
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('announced', '已公告'),
        ('collecting', '收集中'),
        ('quoting', '供应商报价中'),
        ('distributed', '报价已分发'),
        ('ordering', '下单中'),
        ('closed', '已关闭'),
        ('cancelled', '已取消'),
    ]

    title = models.CharField(max_length=200, verbose_name='公告标题')
    description = models.TextField(blank=True, default='', verbose_name='公告描述')
    announce_time = models.DateTimeField(verbose_name='公告时间')
    quote_deadline = models.DateTimeField(verbose_name='报价截止时间')
    order_deadline = models.DateTimeField(verbose_name='下单截止时间')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='状态')

    # 参与产品范围（空=全部活跃产品）
    product_keywords = models.TextField(blank=True, default='', verbose_name='产品关键词（逗号分隔，空=全部）')

    # 推送供应商范围（空=全部有库存供应商）
    supplier_ids = models.TextField(blank=True, default='', verbose_name='指定供应商ID（逗号分隔，空=全部）')

    created_by = models.ForeignKey(
        'platform.PlatformUser', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_announcements', verbose_name='创建人'
    )
    notes = models.TextField(blank=True, default='', verbose_name='备注')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_collective_announcement'
        verbose_name = '集采公告'
        verbose_name_plural = verbose_name
        ordering = ['-announce_time']

    def __str__(self):
        return f'{self.title} ({self.announce_time:%Y-%m-%d})'


class CollectiveParticipation(models.Model):
    """集采参与记录 — 租户参与某次集采的需求登记"""
    STATUS_CHOICES = [
        ('registered', '已登记'),
        ('quoted', '已收到报价'),
        ('ordered', '已下单'),
        ('declined', '已放弃'),
        ('supplier_declined', '供应商拒绝报价'),
    ]

    announcement = models.ForeignKey(
        CollectivePurchaseAnnouncement, on_delete=models.CASCADE,
        related_name='participations', verbose_name='集采公告'
    )
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='collective_participations', verbose_name='租户')
    product = models.ForeignKey(PublicProduct, on_delete=models.CASCADE, related_name='collective_participations', verbose_name='产品')
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='collective_participations', verbose_name='供应商')

    quantity = models.IntegerField(default=1, verbose_name='需求数量')
    quoted_unit_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name='报价单价')
    quoted_total_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True, verbose_name='报价总价')
    final_quantity = models.IntegerField(null=True, blank=True, verbose_name='最终确认数量')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='registered', verbose_name='状态')
    notes = models.TextField(blank=True, default='', verbose_name='备注')
    quote_notes = models.TextField(blank=True, default='', verbose_name='报价备注')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_collective_participation'
        verbose_name = '集采参与'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        unique_together = [('announcement', 'tenant', 'product', 'supplier')]

    def __str__(self):
        return f'{self.tenant.name} - {self.product.name} x{self.quantity}'


class SupplierAccount(models.Model):
    """供应商账号 — 供应商门户登录认证"""
    supplier = models.OneToOneField(Supplier, on_delete=models.CASCADE, related_name='account', verbose_name='供应商')
    username = models.CharField(max_length=100, unique=True, verbose_name='登录用户名')
    password_hash = models.CharField(max_length=200, verbose_name='密码哈希')
    api_token = models.CharField(max_length=200, blank=True, default='', verbose_name='API Token')
    contact_name = models.CharField(max_length=100, blank=True, default='', verbose_name='联系人')
    contact_phone = models.CharField(max_length=50, blank=True, default='', verbose_name='联系电话')
    enabled = models.BooleanField(default=True, verbose_name='是否启用')
    last_login_at = models.DateTimeField(null=True, blank=True, verbose_name='最后登录时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_supplier_account'
        verbose_name = '供应商账号'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.supplier.name} - {self.username}'

    def set_password(self, raw_password):
        """设置密码（使用 Django 的 make_password）"""
        from django.contrib.auth.hashers import make_password
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password):
        """验证密码"""
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.password_hash)


class OrderReturn(models.Model):
    """退货申请 — 租户发起退货，供应商审批"""
    STATUS_CHOICES = [
        ('requested', '待审核'),
        ('approved', '已同意'),
        ('rejected', '已拒绝'),
        ('returning', '退货中'),
        ('completed', '已完成'),
        ('cancelled', '已取消'),
    ]

    return_number = models.CharField(max_length=50, unique=True, verbose_name='退货编号')
    order = models.ForeignKey(ProcurementOrder, on_delete=models.CASCADE, related_name='returns', verbose_name='关联订单')
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='returns', verbose_name='供应商')
    tenant = models.ForeignKey('platform.Tenant', on_delete=models.CASCADE, related_name='order_returns', verbose_name='租户')

    reason = models.TextField(verbose_name='退货原因')
    refund_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name='退款金额')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested', verbose_name='状态')
    supplier_remark = models.TextField(blank=True, default='', verbose_name='供应商处理备注')

    # 退货物流（供应商审批通过后，租户寄回商品的物流单号）
    return_tracking_number = models.CharField(max_length=200, blank=True, default='', verbose_name='退货物流单号')

    processed_at = models.DateTimeField(null=True, blank=True, verbose_name='处理时间')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='完成时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_order_return'
        verbose_name = '退货申请'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.return_number} - {self.order.order_number}'


class SupplierNotification(models.Model):
    """供应商消息通知 — 订单/退货/集采/资质/库存/支付等事件通知"""
    NOTIFICATION_TYPE_CHOICES = [
        ('order_new', '新订单'),
        ('order_status', '订单状态变更'),
        ('order_paid', '订单已支付'),
        ('order_completed', '订单已完成'),
        ('return_requested', '退货申请'),
        ('return_processed', '退货处理结果'),
        ('collective_announcement', '集采公告'),
        ('collective_quote_request', '集采报价请求'),
        ('qualification_expiring', '资质即将到期'),
        ('qualification_expired', '资质已过期'),
        ('low_stock', '库存不足'),
        ('payment_received', '收款到账'),
        ('withdrawal_created', '提现申请已提交'),
        ('withdrawal_completed', '提现已到账'),
        ('withdrawal_rejected', '提现申请被拒绝'),
        ('system', '系统通知'),
    ]

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='notifications', verbose_name='供应商')
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPE_CHOICES, verbose_name='通知类型')
    title = models.CharField(max_length=200, verbose_name='通知标题')
    content = models.TextField(verbose_name='通知内容')
    is_read = models.BooleanField(default=False, verbose_name='是否已读')
    # 关联资源（如订单ID、退货ID、公告ID等）
    related_type = models.CharField(max_length=50, blank=True, default='', verbose_name='关联资源类型')
    related_id = models.IntegerField(null=True, blank=True, verbose_name='关联资源ID')
    # 额外数据（JSON）
    extra_data = models.JSONField(default=dict, blank=True, verbose_name='额外数据')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    read_at = models.DateTimeField(null=True, blank=True, verbose_name='阅读时间')

    class Meta:
        db_table = 'pdb_supplier_notification'
        verbose_name = '供应商通知'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['supplier', 'is_read']),
            models.Index(fields=['supplier', 'created_at']),
        ]

    def __str__(self):
        return f'{self.supplier.name} - {self.title}'

    @property
    def type_display(self):
        return self.get_notification_type_display()


class SupplierWallet(models.Model):
    """供应商钱包 — 跟踪可提现余额"""

    supplier = models.OneToOneField(
        Supplier, on_delete=models.CASCADE,
        related_name='wallet', verbose_name='供应商'
    )
    bank_name = models.CharField(max_length=100, blank=True, default='', verbose_name='开户银行')
    bank_account = models.CharField(max_length=100, blank=True, default='', verbose_name='银行账号')
    bank_holder = models.CharField(max_length=100, blank=True, default='', verbose_name='账户持有人')

    # 银行卡修改验证码（发至平台管理员手机）
    bank_verify_code = models.CharField(max_length=10, blank=True, default='', verbose_name='银行卡修改验证码')
    bank_verify_expires_at = models.DateTimeField(null=True, blank=True, verbose_name='验证码过期时间')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_supplier_wallet'
        verbose_name = '供应商钱包'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.supplier.name} - 钱包'

    @property
    def total_earned(self):
        """总收入 = 所有已完成/已支付订单的 supplier_amount 之和"""
        from django.db.models import Sum
        result = ProcurementOrder.objects.filter(
            supplier=self.supplier,
            payment_status__in=['paid'],
            status__in=['completed', 'shipped', 'delivered']
        ).aggregate(total=Sum('supplier_amount'))
        return result['total'] or 0

    @property
    def total_refunded(self):
        """总退款 = 所有已完成退货的 refund_amount 之和"""
        from django.db.models import Sum
        result = OrderReturn.objects.filter(
            supplier=self.supplier,
            status='completed'
        ).aggregate(total=Sum('refund_amount'))
        return result['total'] or 0

    @property
    def total_withdrawn(self):
        """已提现 = 所有已完成提现的 amount 之和"""
        from django.db.models import Sum
        result = WithdrawalRecord.objects.filter(
            wallet=self,
            status='completed'
        ).aggregate(total=Sum('amount'))
        return result['total'] or 0

    @property
    def pending_withdrawal(self):
        """待处理提现 = pending/processing 状态的提现金额之和"""
        from django.db.models import Sum
        result = WithdrawalRecord.objects.filter(
            wallet=self,
            status__in=['pending', 'processing']
        ).aggregate(total=Sum('amount'))
        return result['total'] or 0

    @property
    def available_balance(self):
        """可提现 = 总收入 - 总退款 - 已提现 - 待处理提现"""
        return self.total_earned - self.total_refunded - self.total_withdrawn - self.pending_withdrawal


class WithdrawalRecord(models.Model):
    """提现记录"""

    STATUS_CHOICES = [
        ('pending', '待审核'),
        ('processing', '处理中'),
        ('completed', '已完成'),
        ('rejected', '已拒绝'),
        ('cancelled', '已取消'),
    ]

    withdrawal_number = models.CharField(max_length=50, unique=True, verbose_name='提现编号')
    wallet = models.ForeignKey(
        SupplierWallet, on_delete=models.CASCADE,
        related_name='withdrawals', verbose_name='钱包'
    )
    supplier = models.ForeignKey(
        Supplier, on_delete=models.CASCADE,
        related_name='withdrawals', verbose_name='供应商'
    )

    amount = models.DecimalField(max_digits=14, decimal_places=2, verbose_name='提现金额')
    fee = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='手续费')

    bank_name = models.CharField(max_length=100, verbose_name='开户银行')
    bank_account = models.CharField(max_length=100, verbose_name='银行账号')
    bank_holder = models.CharField(max_length=100, verbose_name='账户持有人')
    remark = models.TextField(blank=True, default='', verbose_name='备注')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    admin_remark = models.TextField(blank=True, default='', verbose_name='管理员备注')

    processed_at = models.DateTimeField(null=True, blank=True, verbose_name='处理时间')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='完成时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'pdb_withdrawal_record'
        verbose_name = '提现记录'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['supplier', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f'{self.withdrawal_number} - {self.amount}'

    @property
    def status_display(self):
        return self.get_status_display()

    @property
    def net_amount(self):
        """实际到账 = 提现金额 - 手续费"""
        return self.amount - self.fee
