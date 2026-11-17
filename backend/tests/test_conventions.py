"""The two rules every response follows (root CLAUDE.md › API contract): camelCase JSON, and errors as {"detail": "..."}."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import add_error_handlers
from app.core.schemas import CamelModel


class Price(CamelModel):
    service_id: str
    price_paise: int


def make_client() -> TestClient:
    app = FastAPI()
    add_error_handlers(app)

    @app.post("/prices", response_model=Price)
    def echo(price: Price) -> Price:
        return price

    return TestClient(app)


def test_json_is_camel_case_both_ways() -> None:
    response = make_client().post("/prices", json={"serviceId": "dog-signature-bath", "pricePaise": 120000})
    assert response.status_code == 200
    assert response.json() == {"serviceId": "dog-signature-bath", "pricePaise": 120000}


def test_bad_input_is_one_readable_detail() -> None:
    response = make_client().post("/prices", json={"serviceId": "dog-signature-bath", "pricePaise": "a lot"})
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert isinstance(detail, str) and detail.startswith("pricePaise: ")
