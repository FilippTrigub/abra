"""Provider registry — auto-detects from env, or accepts explicit name."""

import os
import sys

from .base import EmailProvider
from .kit import KitProvider
from .mailchimp import MailchimpProvider
from .resend import ResendProvider
from .sendgrid import SendGridProvider

_REGISTRY: dict[str, tuple[type[EmailProvider], str]] = {
    "resend": (ResendProvider, "RESEND_API_KEY"),
    "mailchimp": (MailchimpProvider, "MAILCHIMP_API_KEY"),
    "sendgrid": (SendGridProvider, "SENDGRID_API_KEY"),
    "kit": (KitProvider, "KIT_API_SECRET"),
}

_PRIORITY = ["resend", "mailchimp", "sendgrid", "kit"]


def get_provider(name: str | None = None) -> EmailProvider:
    if name:
        if name not in _REGISTRY:
            sys.exit(f"Error: unknown provider '{name}'. Choose from: {', '.join(_REGISTRY)}")
        cls, env_var = _REGISTRY[name]
        if not os.environ.get(env_var):
            sys.exit(f"Error: {env_var} not set (required for {name})")
        return cls()

    for pname in _PRIORITY:
        cls, env_var = _REGISTRY[pname]
        if os.environ.get(env_var):
            print(f"Auto-selected provider: {pname} (found {env_var})")
            return cls()

    keys = ", ".join(v for _, v in _REGISTRY.values())
    sys.exit(f"Error: no email provider configured. Set one of: {keys}")
