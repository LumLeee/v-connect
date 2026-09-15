from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.models import Skill

SKILLS = [
    ("giao-tiep", "Giao tiếp"), ("to-chuc-su-kien", "Tổ chức sự kiện"),
    ("giang-day", "Giảng dạy"), ("so-cuu", "Sơ cứu"),
    ("nhiep-anh", "Nhiếp ảnh"), ("thiet-ke", "Thiết kế"),
    ("truyen-thong", "Truyền thông"), ("cong-nghe", "Công nghệ"),
]


class Command(BaseCommand):
    help = "Create initial skill catalog, without demo accounts or fabricated activity data."

    @transaction.atomic
    def handle(self, *args, **options):
        created = 0
        for slug, name in SKILLS:
            _, is_new = Skill.objects.get_or_create(slug=slug, defaults={"name": name})
            created += is_new
        self.stdout.write(self.style.SUCCESS(f"Skills: {created} created; existing records preserved."))
