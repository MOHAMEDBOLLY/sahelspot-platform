from pydantic import BaseModel

# Deliberately generic — not Venue-specific — so a future validate_destination()
# (or any other entity's validator) returns the exact same shape. One reusable
# response contract for "is this row valid," not one per entity.


class FieldError(BaseModel):
    field: str
    message: str


class ValidationResult(BaseModel):
    """As of Sprint 13, this is an *editorial readiness* result, not just a
    pass/fail check — see docs/ROADMAP.md's Sprint 13 entry for why that's a
    distinct concept from Review itself. `errors` is unchanged from Sprint 12
    and is still the only thing `valid`/`ready_for_review` are derived from;
    `warnings` and `info` are additive extension points, empty until a real
    rule needs them — nothing currently populates them.
    """

    valid: bool
    ready_for_review: bool
    errors: list[FieldError]
    warnings: list[FieldError] = []
    info: list[FieldError] = []


def build_validation_result(
    errors: list[FieldError],
    warnings: list[FieldError] | None = None,
    info: list[FieldError] | None = None,
) -> ValidationResult:
    """The one place `valid`/`ready_for_review` are derived from a rule set's
    findings — shared by every entity's validator (`validate_venue`, and any
    future `validate_destination`) so the derivation logic exists exactly
    once, not once per entity.

    No rule currently makes a warning block readiness — `ready_for_review`
    is simply `valid` for now, per this sprint's "don't invent business
    rules yet" instruction. If a future warning should block Review, this is
    the only place that needs to change.
    """
    warnings = warnings if warnings is not None else []
    info = info if info is not None else []
    valid = len(errors) == 0

    return ValidationResult(
        valid=valid,
        ready_for_review=valid,
        errors=errors,
        warnings=warnings,
        info=info,
    )
