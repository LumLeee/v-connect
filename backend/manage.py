"""Django command-line entry point."""
import os
import sys
from pathlib import Path

if __name__ == "__main__":
    # Keep discovery and relative commands consistent from any working directory.
    os.chdir(Path(__file__).resolve().parent)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
