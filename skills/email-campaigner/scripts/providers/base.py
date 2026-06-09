"""Abstract base for all email providers."""

from abc import ABC, abstractmethod
from typing import Any


class EmailProvider(ABC):
    name: str

    @abstractmethod
    def send(self, brief: dict[str, Any]) -> dict[str, Any]:
        """Send a campaign from a brief dict. Returns a result dict."""
        ...
