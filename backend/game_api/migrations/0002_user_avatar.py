# Generated for avatar upload support

import django.core.validators
from django.db import migrations, models

import game_api.models


class Migration(migrations.Migration):

    dependencies = [
        ('game_api', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='user',
            name='avatar_url',
        ),
        migrations.AddField(
            model_name='user',
            name='avatar',
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to=game_api.models.avatar_upload_to,
                validators=[django.core.validators.FileExtensionValidator(['png', 'jpg', 'jpeg'])],
            ),
        ),
    ]
