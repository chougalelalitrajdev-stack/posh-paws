"""The base for every request and response shape."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Python names are snake_case (price_paise); the JSON the apps send and receive is camelCase (pricePaise).

    from_attributes lets a shape be filled straight from a database row.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)
