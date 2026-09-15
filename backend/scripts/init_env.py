"""Create a local environment without overwriting existing user configuration."""
import secrets
from pathlib import Path

backend = Path(__file__).resolve().parents[1]
destination = backend / ".env"
if destination.exists():
    print("backend/.env already exists; preserved.")
else:
    template = (backend / ".env.example").read_text(encoding="utf-8")
    template = template.replace("replace-with-a-random-secret", secrets.token_urlsafe(64))
    template = template.replace("replace-with-a-random-password", secrets.token_urlsafe(32))
    destination.write_text(template, encoding="utf-8")
    print("Created backend/.env with random application secrets. Configure MySQL admin credentials locally.")
