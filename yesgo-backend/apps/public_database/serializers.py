from rest_framework import serializers
from django.db.models import Sum
from .models import (
    Supplier, CommissionProtocol, SupplierQualification,
    TenantQualification, FirstOperationRecord,
    PublicProduct, CollectiveBatch, ProcurementQuote,
    ProcurementOrder, OrderItem, QualificationExchange, PaymentRecord,
    SupplierDeliveryRule, CollectivePurchaseAnnouncement,
    CollectiveParticipation, SupplierAccount, OrderReturn,
    WithdrawalRecord,
)


class SupplierQualificationSerializer(serializers.ModelSerializer):
    qualification_type_display = serializers.CharField(source='get_qualification_type_display', read_only=True)

    class Meta:
        model = SupplierQualification
        fields = ['id', 'supplier', 'qualification_type', 'qualification_type_display',
                  'qualification_name', 'file_url', 'file_name', 'license_number',
                  'issue_date', 'expiry_date', 'verified', 'file_size',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class TenantQualificationSerializer(serializers.ModelSerializer):
    """租户资质序列化器"""
    qualification_type_display = serializers.CharField(source='get_qualification_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = TenantQualification
        fields = ['id', 'tenant', 'tenant_name', 'qualification_type', 'qualification_type_display',
                  'qualification_name', 'file_url', 'file_name', 'license_number',
                  'issue_date', 'expiry_date', 'verified', 'status', 'status_display',
                  'file_size', 'created_at', 'updated_at']
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']


class FirstOperationRecordSerializer(serializers.ModelSerializer):
    """首营记录序列化器"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    buyer_tenant_name = serializers.CharField(source='buyer_tenant.name', read_only=True)
    seller_supplier_name = serializers.CharField(source='seller_supplier.name', read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = FirstOperationRecord
        fields = [
            'id', 'record_number', 'buyer_tenant', 'buyer_tenant_name',
            'seller_supplier', 'seller_supplier_name',
            'buyer_qualifications', 'seller_qualifications',
            'buyer_confirmed', 'buyer_confirmed_at',
            'seller_confirmed', 'seller_confirmed_at',
            'buyer_remark', 'seller_remark',
            'status', 'status_display',
            'e_signature_service', 'e_signature_contract_id',
            'e_signature_signed_at', 'e_signature_contract_url',
            'valid_from', 'valid_until', 'is_valid',
            'external_reused', 'external_source',
            'created_by', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'record_number', 'buyer_qualifications', 'seller_qualifications',
            'buyer_confirmed', 'buyer_confirmed_at',
            'seller_confirmed', 'seller_confirmed_at',
            'status', 'e_signature_service', 'e_signature_contract_id',
            'e_signature_signed_at', 'e_signature_contract_url',
            'valid_from', 'valid_until', 'created_at', 'updated_at',
            'external_reused', 'external_source',
        ]


class CommissionProtocolSerializer(serializers.ModelSerializer):
    protocol_type_display = serializers.CharField(source='get_protocol_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = CommissionProtocol
        fields = ['id', 'supplier', 'supplier_name', 'protocol_type', 'protocol_type_display',
                  'value', 'min_commission', 'effective_from', 'effective_until',
                  'status', 'status_display', 'signed_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class SupplierSerializer(serializers.ModelSerializer):
    supplier_type_display = serializers.CharField(source='get_supplier_type_display', read_only=True)
    qualification_status_display = serializers.CharField(source='get_qualification_status_display', read_only=True)
    qualifications = SupplierQualificationSerializer(many=True, read_only=True)
    commission_protocols = CommissionProtocolSerializer(many=True, read_only=True)
    product_count = serializers.SerializerMethodField()
    active_protocol = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = ['id', 'name', 'code', 'supplier_type', 'supplier_type_display',
                  'enterprise_id', 'contact_name', 'contact_phone', 'contact_email', 'address',
                  'province', 'city',
                  'payment_account_id',
                  'api_base_url', 'api_token', 'sync_enabled', 'last_synced_at',
                  'qualification_status', 'qualification_status_display',
                  'qualification_verified_at', 'qualification_remark',
                  'enabled', 'sort_order', 'created_at', 'updated_at',
                  'qualifications', 'commission_protocols',
                  'product_count', 'active_protocol']
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_synced_at', 'qualification_verified_at']

    def get_product_count(self, obj):
        return obj.products.count()

    def get_active_protocol(self, obj):
        protocol = obj.commission_protocols.filter(status='active').first()
        if protocol:
            return CommissionProtocolSerializer(protocol).data
        return None


class PublicProductSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_id = serializers.IntegerField(source='supplier.id', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PublicProduct
        fields = ['id', 'supplier', 'supplier_id', 'supplier_name',
                  'product_code', 'name', 'trade_name', 'specification',
                  'manufacturer', 'dosage_form', 'unit', 'price', 'min_order_quantity',
                  'category', 'approval_number', 'barcode',
                  'image_url',
                  'knowledge_graph', 'manual_url', 'manual_text',
                  'sales_regions', 'sales_channels',
                  'delivery_info', 'storage_condition', 'delivery_areas',
                  'search_vector', 'stock_quantity', 'status', 'status_display',
                  'last_synced_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_synced_at', 'search_vector']


class PublicProductDetailSerializer(PublicProductSerializer):
    """产品详情序列化器，包含供应商资质信息"""
    supplier_info = serializers.SerializerMethodField()

    class Meta(PublicProductSerializer.Meta):
        fields = PublicProductSerializer.Meta.fields + ['supplier_info']

    def get_supplier_info(self, obj):
        return {
            'id': obj.supplier.id,
            'name': obj.supplier.name,
            'code': obj.supplier.code,
            'enterprise_id': obj.supplier.enterprise_id,
            'qualification_status': obj.supplier.qualification_status,
            'qualification_status_display': obj.supplier.get_qualification_status_display(),
            'contact_name': obj.supplier.contact_name,
            'contact_phone': obj.supplier.contact_phone,
            'address': obj.supplier.address,
            'qualifications': SupplierQualificationSerializer(obj.supplier.qualifications.all(), many=True).data,
        }


class CollectiveBatchSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    notify_method_display = serializers.CharField(source='get_notify_method_display', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_spec = serializers.CharField(source='product.specification', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    quote_count = serializers.SerializerMethodField()

    class Meta:
        model = CollectiveBatch
        fields = ['id', 'batch_date', 'product', 'product_name', 'product_spec',
                  'supplier', 'supplier_name', 'status', 'status_display',
                  'total_quantity', 'quoted_price', 'quoted_at', 'expires_at',
                  'notify_method', 'notify_method_display',
                  'notes', 'quote_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'quoted_at', 'total_quantity']

    def get_quote_count(self, obj):
        return obj.quotes.count()


class ProcurementQuoteSerializer(serializers.ModelSerializer):
    quote_type_display = serializers.CharField(source='get_quote_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_spec = serializers.CharField(source='product.specification', read_only=True)
    product_manufacturer = serializers.CharField(source='product.manufacturer', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = ProcurementQuote
        fields = ['id', 'quote_type', 'quote_type_display',
                  'tenant', 'tenant_name', 'product', 'product_name', 'product_spec', 'product_manufacturer',
                  'supplier', 'supplier_name', 'collective_batch', 'agent_id',
                  'quantity', 'unit_price', 'total_price',
                  'status', 'status_display', 'notes', 'expires_at',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'unit_price', 'total_price']


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['id', 'order', 'product', 'product_name', 'product_spec',
                  'product_manufacturer', 'product_unit', 'quantity', 'unit_price', 'total_price']
        read_only_fields = ['id']


class ProcurementOrderSerializer(serializers.ModelSerializer):
    order_type_display = serializers.CharField(source='get_order_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = ProcurementOrder
        fields = ['id', 'order_number', 'tenant', 'tenant_name', 'supplier', 'supplier_name',
                  'quote', 'order_type', 'order_type_display',
                  'status', 'status_display',
                  'total_amount', 'commission_amount', 'supplier_amount',
                  'payment_method', 'payment_method_display',
                  'payment_status', 'payment_status_display',
                  'supplier_order_id', 'supplier_order_synced',
                  'qualification_exchange_status',
                  'e_signature_status', 'e_signature_contract_id',
                  'tracking_number',
                  'notes', 'items', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'order_number',
                           'commission_amount', 'supplier_amount', 'supplier_order_id',
                           'supplier_order_synced', 'e_signature_status', 'e_signature_contract_id']


class QualificationExchangeSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)

    class Meta:
        model = QualificationExchange
        fields = ['id', 'order', 'order_number',
                  'buyer_qualifications', 'seller_qualifications',
                  'status', 'status_display',
                  'e_signature_service', 'e_signature_contract_id', 'e_signature_signed_at',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at',
                           'e_signature_contract_id', 'e_signature_signed_at']


class PaymentRecordSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)

    class Meta:
        model = PaymentRecord
        fields = ['id', 'order', 'order_number', 'payment_method', 'payment_method_display',
                  'amount', 'commission_amount', 'supplier_amount',
                  'status', 'status_display',
                  'channel', 'channel_transaction_id', 'channel_split_id',
                  'paid_at', 'split_at', 'error_message',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at',
                           'commission_amount', 'supplier_amount',
                           'channel_transaction_id', 'channel_split_id',
                           'paid_at', 'split_at']


class SupplierDeliveryRuleSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = SupplierDeliveryRule
        fields = ['id', 'supplier', 'supplier_name', 'province', 'city',
                  'delivery_hours', 'min_order_amount', 'enabled',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        province = attrs.get('province', '')
        city = attrs.get('city', [])
        if not isinstance(city, list):
            raise serializers.ValidationError({'city': '城市必须是数组'})
        if not province and city:
            raise serializers.ValidationError({'city': '全国规则不能指定具体城市'})
        attrs['city'] = [c.strip() for c in city if c and c.strip()]
        return attrs


class CollectivePurchaseAnnouncementSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    participation_count = serializers.SerializerMethodField()
    total_quantity = serializers.SerializerMethodField()

    class Meta:
        model = CollectivePurchaseAnnouncement
        fields = ['id', 'title', 'description',
                  'announce_time', 'quote_deadline', 'order_deadline',
                  'status', 'status_display',
                  'product_keywords', 'supplier_ids',
                  'created_by', 'notes',
                  'participation_count', 'total_quantity',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']

    def get_participation_count(self, obj):
        return obj.participations.values('tenant').distinct().count()

    def get_total_quantity(self, obj):
        return obj.participations.aggregate(t=Sum('quantity'))['t'] or 0


class CollectiveParticipationSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_spec = serializers.CharField(source='product.specification', read_only=True)
    product_manufacturer = serializers.CharField(source='product.manufacturer', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    announcement_title = serializers.CharField(source='announcement.title', read_only=True)

    class Meta:
        model = CollectiveParticipation
        fields = ['id', 'announcement', 'announcement_title',
                  'tenant', 'tenant_name',
                  'product', 'product_name', 'product_spec', 'product_manufacturer',
                  'supplier', 'supplier_name',
                  'quantity', 'quoted_unit_price', 'quoted_total_price', 'final_quantity',
                  'status', 'status_display', 'notes', 'quote_notes',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at',
                           'quoted_unit_price', 'quoted_total_price', 'final_quantity']


class SupplierAccountSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = SupplierAccount
        fields = ['id', 'supplier', 'supplier_name', 'username',
                  'contact_name', 'contact_phone', 'api_token',
                  'enabled', 'last_login_at',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at',
                           'password_hash', 'api_token', 'last_login_at']


class OrderReturnSerializer(serializers.ModelSerializer):
    """退货申请序列化器"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    order_items = serializers.SerializerMethodField()

    class Meta:
        model = OrderReturn
        fields = ['id', 'return_number', 'order', 'order_number',
                  'supplier', 'supplier_name', 'tenant', 'tenant_name',
                  'reason', 'refund_amount',
                  'status', 'status_display', 'supplier_remark',
                  'return_tracking_number',
                  'processed_at', 'completed_at',
                  'order_items',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at',
                           'return_number', 'processed_at', 'completed_at',
                           'order_number', 'tenant_name', 'supplier_name',
                           'order_items']

    def get_order_items(self, obj):
        """获取关联订单的商品明细"""
        items = obj.order.items.all()
        return OrderItemSerializer(items, many=True).data


class WithdrawalRecordSerializer(serializers.ModelSerializer):
    """提现记录序列化器"""
    status_display = serializers.CharField(read_only=True)
    net_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_code = serializers.CharField(source='supplier.code', read_only=True)

    class Meta:
        model = WithdrawalRecord
        fields = [
            'id', 'withdrawal_number',
            'supplier_name', 'supplier_code',
            'amount', 'fee', 'net_amount',
            'bank_name', 'bank_account', 'bank_holder',
            'remark', 'status', 'status_display',
            'admin_remark',
            'processed_at', 'completed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'withdrawal_number', 'fee', 'net_amount',
            'supplier_name', 'supplier_code',
            'status', 'status_display', 'admin_remark',
            'processed_at', 'completed_at',
            'created_at', 'updated_at',
        ]
