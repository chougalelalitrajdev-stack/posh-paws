from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    """Lets the front-ends and the host check the API is up and the database answers."""
    try:
        db.execute(text("select 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="The database isn't reachable.")
    return {"status": "ok", "database": "ok"}
