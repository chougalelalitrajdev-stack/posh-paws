"""Every error leaves the API as {"detail": "a readable message"}, which the apps show to the user."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def add_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def invalid_input(request: Request, exc: RequestValidationError) -> JSONResponse:
        # FastAPI lists every problem with its location; the apps need one sentence, so we send the first.
        first = exc.errors()[0]
        message = str(first.get("msg", "Invalid input.")).removeprefix("Value error, ")
        # Our own messages ("Enter the business name.") are already written for people; built-in ones get the field name.
        if first.get("type") == "value_error" or not first.get("loc"):
            return JSONResponse(status_code=422, content={"detail": message})
        return JSONResponse(status_code=422, content={"detail": f"{first['loc'][-1]}: {message}"})
