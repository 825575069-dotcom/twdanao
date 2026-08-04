from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wecom', '0016_wecomgrouproom_member_user_ids_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='wecomcontact',
            name='contact_source',
            field=models.CharField(
                choices=[
                    ('wechat', '微信好友'),
                    ('wecom', '企微同事'),
                    ('group_chat', '群聊成员'),
                    ('unknown', '未知'),
                ],
                default='unknown',
                max_length=20,
                verbose_name='联系人来源',
            ),
        ),
        migrations.AddField(
            model_name='wecomcontact',
            name='qiwe_contact_type',
            field=models.IntegerField(default=0, verbose_name='QiWe联系人类型'),
        ),
        migrations.AddField(
            model_name='wecomcontact',
            name='qiwe_add_time',
            field=models.BigIntegerField(default=0, verbose_name='QiWe添加时间'),
        ),
        migrations.AddField(
            model_name='wecomcontact',
            name='gender',
            field=models.IntegerField(default=0, verbose_name='性别 0未设置 1男 2女'),
        ),
        migrations.AddField(
            model_name='wecomcontact',
            name='mobile',
            field=models.CharField(blank=True, default='', max_length=50, verbose_name='手机号'),
        ),
    ]