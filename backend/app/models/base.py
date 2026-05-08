import uuid
from sqlalchemy.types import TypeDecorator, String as SaString


class UUID(TypeDecorator):
    """Database-agnostic UUID stored as VARCHAR(36)."""
    impl = SaString(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return uuid.UUID(str(value))
