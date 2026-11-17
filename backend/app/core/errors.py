"""Every error leaves the API as {"detail": "a readable message"}, which the apps show to the user."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def add_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def invalid_input(request: Request, exc: RequestValidationError) -> JSONResponse:
        # FastAPI lists every problem with its location; the apps need one sentence, so we send the first.
        first = exc.errors()[0]
        field = str(first["loc"][-1]) if first.get("loc") else ""
        message = str(first.get("msg", "Invalid input.")).removeprefix("Value error, ")
        return JSONResponse(status_code=422, content={"detail": f"{field}: {message}" if field else message})
