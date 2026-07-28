from app.db.models import Destination

from .schemas import FieldError, ValidationResult, build_validation_result


def validate_destination(destination: Destination) -> ValidationResult:
    """PLATFORM_SPEC_v1.0_FROZEN.md §4.4 — the Editorial Readiness gate for
    destinations: `name` and `region` non-blank. Mirrors `validate_venue`'s
    shape exactly (see `app/validation/schemas.py`'s docstring on why the
    result contract is entity-agnostic) — this is the first entity beyond
    venues to actually use it.
    """
    errors: list[FieldError] = []

    if not destination.name or not destination.name.strip():
        errors.append(FieldError(field="name", message="Name is required."))

    if not destination.region or not destination.region.strip():
        errors.append(FieldError(field="region", message="Region is required."))

    return build_validation_result(errors)
