def notification_href(notification, recipient=None, *, persistent=False):
    """Resolve public links; emails use account views that survive status changes."""
    activity = notification.activity
    if not activity or notification.href != f'/hoat-dong/{activity.pk}':
        return notification.href
    if not persistent and activity.status == 'published' and activity.published_at is not None:
        return notification.href

    recipient = recipient or notification.recipient
    if recipient.role == 'volunteer':
        return ('/tinh-nguyen-vien/dang-ky?status=cancelled'
                if not persistent and activity.status == 'cancelled' else '/tinh-nguyen-vien/dang-ky')
    if recipient.role == 'organizer' and activity.organizer_id == recipient.pk:
        return f'/nha-to-chuc/hoat-dong/{activity.pk}'
    if recipient.role == 'admin':
        return f'/bao-cao/hoat-dong/{activity.pk}'
    return '/thong-bao'
