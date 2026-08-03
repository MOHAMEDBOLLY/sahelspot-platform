from app.db.models import Event

from .schemas import FieldError, ValidationResult, build_validation_result


def validate_event(event: Event) -> ValidationResult:
    """Editorial Readiness for events — mirrors `validate_destination`'s
    minimal shape exactly. `start_date` isn't checked here: it's a
    required (`NOT NULL`) column, so a row can't exist without one —
    unlike `title`, which the database allows blank/whitespace-only.
    """
    errors: list[FieldError] = []

    if not event.title or not event.title.strip():
        errors.append(FieldError(field="title", message="Title is required."))

    return build_validation_result(errors)
