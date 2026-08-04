"""
0013 — 新增 WecomGlobalConfig + WecomNumber 模型，扩展 WecomDevice 字段
"""
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('platform', '0018_expand_prompt_category'),
        ('wecom', '0012_wecomdevice_province_code'),
    ]

    operations = [
        # 1. 新增 WecomGlobalConfig（singleton）
        migrations.CreateModel(
            name='WecomGlobalConfig',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sdk_url', models.URLField(
                    default='https://manager.qiweapi.com/qiwe/api/qw/doApi',
                    verbose_name='企微SDK地址')),
                ('sdk_token', models.CharField(max_length=500, verbose_name='SDK Token')),
                ('callback_token', models.CharField(
                    blank=True, default='', max_length=500, verbose_name='回调 Token')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
            ],
            options={
                'verbose_name': '企微全局配置',
                'verbose_name_plural': '企微全局配置',
                'db_table': 'wecom_global_config',
            },
        ),

        # 2. 新增 WecomNumber
        migrations.CreateModel(
            name='WecomNumber',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('guid', models.CharField(max_length=100, unique=True, verbose_name='设备GUID')),
                ('province_code', models.CharField(max_length=10, verbose_name='设备归属省代码')),
                ('province_name', models.CharField(
                    blank=True, default='', max_length=50, verbose_name='设备归属省名称')),
                ('remark', models.CharField(
                    blank=True, default='', max_length=200, verbose_name='备注（归属企业）')),
                ('device_name', models.CharField(
                    blank=True, default='', max_length=200, verbose_name='设备名称')),
                ('device_type', models.IntegerField(default=0, verbose_name='设备类型(0=iPad,1=Windows)')),
                ('proxy_url', models.URLField(blank=True, default='', verbose_name='代理URL')),
                ('client_version', models.CharField(
                    blank=True, default='', max_length=50, verbose_name='客户端版本')),
                ('expires_at', models.DateTimeField(blank=True, null=True, verbose_name='有效期')),
                ('price', models.DecimalField(
                    decimal_places=2, default=0, max_digits=10, verbose_name='收费标准(元/月)')),
                ('status', models.CharField(
                    choices=[
                        ('created', '已创建'),
                        ('bound', '已绑定'),
                        ('expired', '已过期'),
                        ('offline', '已下线'),
                    ],
                    default='created', max_length=20, verbose_name='企微号状态')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('tenant', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='wecom_numbers', to='platform.tenant', verbose_name='归属租户')),
            ],
            options={
                'verbose_name': '企微号',
                'verbose_name_plural': '企微号',
                'db_table': 'wecom_number',
                'ordering': ['-created_at'],
            },
        ),

        # 3. WecomDevice 新增字段
        migrations.AddField(
            model_name='wecomdevice',
            name='wecom_number',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='devices', to='wecom.wecomnumber', verbose_name='关联企微号'),
        ),
        migrations.AddField(
            model_name='wecomdevice',
            name='mobile',
            field=models.CharField(blank=True, default='', max_length=20, verbose_name='绑定手机号'),
        ),
        migrations.AddField(
            model_name='wecomdevice',
            name='remark',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='绑定备注'),
        ),
        migrations.AddField(
            model_name='wecomdevice',
            name='login_status',
            field=models.IntegerField(blank=True, null=True, verbose_name='登录状态码'),
        ),
        migrations.AddField(
            model_name='wecomdevice',
            name='bound_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='绑定时间'),
        ),

        # 4. WecomNumber.bound_device（OneToOne → WecomDevice，需在 WecomDevice 字段之后添加）
        migrations.AddField(
            model_name='wecomnumber',
            name='bound_device',
            field=models.OneToOneField(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='wecom_number_link', to='wecom.wecomdevice',
                verbose_name='绑定的设备'),
        ),
    ]
