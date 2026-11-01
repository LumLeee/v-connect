from django.db.models import Q, Sum
from django.db.models.functions import Coalesce
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User


LEVELS = [
    ('beginner', 'Khởi đầu', 0),
    ('companion', 'Đồng hành', 20),
    ('active', 'Tích cực', 50),
    ('pioneer', 'Tiên phong', 100),
    ('inspiration', 'Truyền cảm hứng', 200),
]


def level_for(score):
    index = max(i for i, (_, _, minimum) in enumerate(LEVELS) if score >= minimum)
    key, name, minimum = LEVELS[index]
    next_level = LEVELS[index + 1] if index + 1 < len(LEVELS) else None
    return {'key': key, 'name': name, 'min_score': minimum,
            'next_min_score': next_level[2] if next_level else None,
            'next_name': next_level[1] if next_level else None,
            'progress': min(100, (score - minimum) * 100 // (next_level[2] - minimum)) if next_level else 100}


def totals():
    # Same completed/approved/attended eligibility as personal contribution totals.
    eligible = Q(participations__status='approved', participations__activity__status='completed',
                 participations__activity__ends_at__lte=timezone.now())
    return User.objects.filter(role='volunteer', is_active=True).annotate(
        total_score=Coalesce(Sum('participations__attendance__contribution__score', filter=eligible), 0))


def ranked_users():
    # Exactly 20 people; ties at the cut-off use stable membership date/UUID order.
    return totals().filter(total_score__gt=0).order_by('-total_score', 'date_joined', 'pk')


def person(user, rank, viewer):
    return {'rank': rank, 'full_name': user.full_name,
            'avatar_url': f'/api/v1/leaderboard/avatars/{user.pk}/' if user.avatar else None,
            'total_score': user.total_score, 'level': level_for(user.total_score), 'is_me': user.pk == viewer.pk}


@method_decorator(never_cache, name='dispatch')
class Leaderboard(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        leaders = list(ranked_users()[:20])
        rows = []
        previous_score = None
        rank = 0
        mine = None
        for position, user in enumerate(leaders, start=1):
            if user.total_score != previous_score:
                rank = position
            row = person(user, rank, request.user)
            rows.append(row)
            if row['is_me']:
                mine = row
            previous_score = user.total_score
        if request.user.role == 'volunteer' and mine is None:
            user = totals().filter(pk=request.user.pk).first()
            if user is not None:
                rank = totals().filter(total_score__gt=user.total_score).count() + 1 if user.total_score > 0 else None
                mine = person(user, rank, request.user)
        return Response({'results': rows, 'me': mine, 'limit': 20,
                         'levels': [{'key': key, 'name': name, 'min_score': minimum,
                                     'max_score': LEVELS[i + 1][2] - 1 if i + 1 < len(LEVELS) else None}
                                    for i, (key, name, minimum) in enumerate(LEVELS)],
                         'updated_at': timezone.now()})


@method_decorator(never_cache, name='dispatch')
class LeaderboardAvatar(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        leader_ids = list(ranked_users().values_list('pk', flat=True)[:20])
        allowed = Q(pk__in=leader_ids)
        if request.user.role == 'volunteer':
            allowed |= Q(pk=request.user.pk)
        user = get_object_or_404(User.objects.filter(role='volunteer', is_active=True).filter(allowed), pk=pk)
        if not user.avatar:
            raise NotFound('Không có ảnh đại diện.')
        try:
            return FileResponse(user.avatar.open('rb'), content_type='image/jpeg')
        except FileNotFoundError as exc:
            raise NotFound('Không tìm thấy ảnh đại diện.') from exc
