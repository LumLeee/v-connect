import logging

from django.http import JsonResponse
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger("vconnect.api")


def error_payload(code, message, details=None):
    return {"error": {"code": code, "message": message, "details": details or {}}}


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API error request_id=%s",
                         getattr(context.get("request"), "request_id", "unknown"))
        return Response(error_payload("server_error", "Có lỗi hệ thống. Vui lòng thử lại sau."), status=500)
    messages = {
        400: "Dữ liệu gửi lên không hợp lệ.", 401: "Vui lòng đăng nhập.",
        403: "Bạn không có quyền thực hiện thao tác này.",
        404: "Không tìm thấy nội dung yêu cầu.",
        405: "Phương thức không được hỗ trợ.",
        429: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
    }
    response.data = error_payload(
        getattr(exc, "default_code", "request_error"),
        messages.get(response.status_code, "Không thể xử lý yêu cầu."), response.data,
    )
    return response


def bad_request(request, exception):
    return JsonResponse(error_payload("bad_request", "Yêu cầu không hợp lệ."), status=400)


def permission_denied(request, exception):
    return JsonResponse(error_payload("permission_denied", "Bạn không có quyền truy cập."), status=403)


def not_found(request, exception):
    return JsonResponse(error_payload("not_found", "Không tìm thấy nội dung yêu cầu."), status=404)


def server_error(request):
    return JsonResponse(error_payload("server_error", "Có lỗi hệ thống. Vui lòng thử lại sau."), status=500)
