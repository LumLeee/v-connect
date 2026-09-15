import logging
import time
import uuid

logger = logging.getLogger("vconnect.requests")


class RequestLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.request_id = uuid.uuid4().hex
        started = time.monotonic()
        response = self.get_response(request)
        response["X-Request-ID"] = request.request_id
        # Do not log request bodies, cookies, authorization headers or query values.
        logger.info("%s %s status=%s duration_ms=%.1f request_id=%s",
                    request.method, request.path, response.status_code,
                    (time.monotonic() - started) * 1000, request.request_id)
        return response
