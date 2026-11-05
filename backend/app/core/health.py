from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    """Lets the front-ends and the host check the API is up."""
    return {"status": "ok"}
