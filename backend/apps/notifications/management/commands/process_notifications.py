import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections
from apps.notifications.delivery import create_reminders, deliver_emails


class Command(BaseCommand):
    help = 'Tạo nhắc lịch trước 1 giờ và xử lý hàng đợi email; dùng --loop để chạy mỗi phút.'

    def add_arguments(self, parser):
        parser.add_argument('--loop', action='store_true')
        parser.add_argument('--limit', type=int, default=200)
        parser.add_argument('--reminders-only', action='store_true')

    def handle(self, *args, **options):
        from django.core.management.base import CommandError
        # Windows redirected terminals may default to cp1252. Both progress
        # messages and the console email backend contain Vietnamese text.
        for stream in (self.stdout, self.stderr):
            if hasattr(stream, 'reconfigure'):
                stream.reconfigure(encoding='utf-8')
        if not 1 <= options['limit'] <= 10000:
            raise CommandError('--limit phải nằm trong khoảng 1–10000.')
        try:
            while True:
                close_old_connections()
                reminders = create_reminders(options['limit'])
                emails = 0 if options['reminders_only'] else deliver_emails(options['limit'])
                self.stdout.write(f'Nhắc lịch mới: {reminders}; email đã xử lý: {emails}.')
                if not options['loop']:
                    break
                time.sleep(60)
        except KeyboardInterrupt:
            self.stdout.write('Đã dừng xử lý thông báo.')
