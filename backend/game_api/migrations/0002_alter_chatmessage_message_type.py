from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("game_api", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="chatmessage",
            name="message_type",
            field=models.CharField(
                choices=[
                    ("text", "Text"),
                    ("game_invite", "Game invite"),
                    ("system", "System"),
                ],
                default="text",
                max_length=15,
            ),
        ),
    ]
