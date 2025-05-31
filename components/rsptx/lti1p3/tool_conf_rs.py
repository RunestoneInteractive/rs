import os

from rsptx.db.crud import (
    fetch_lti1p3_config_by_lti_data,
)

from rsptx.lti1p3.pylti1p3.tool_config import ToolConfAbstract
from rsptx.lti1p3.pylti1p3.registration import Registration
from rsptx.lti1p3.pylti1p3.deployment import Deployment


class ToolConfRS(ToolConfAbstract):
    async def find_registration_by_params(
        self, iss: str, client_id: str = None, *args, **kwargs
    ) -> Registration:
        if not client_id or client_id == "":
            client_id = "default"

        lti_conf = await fetch_lti1p3_config_by_lti_data(iss, client_id)

        if not lti_conf:
            raise Exception("No LTI 1.3 configuration found")

        reg = self.registration_from_lti_config(lti_conf)
        return reg
    
    @classmethod
    def registration_from_lti_config(cls, lti_conf):
        reg = Registration()
        reg.set_issuer(lti_conf.issuer).set_client_id(
            lti_conf.client_id
        ).set_auth_login_url(
            lti_conf.auth_login_url
        ).set_auth_token_url(
            lti_conf.auth_token_url
        ).set_key_set_url(
            lti_conf.key_set_url
        ).set_auth_audience(
            lti_conf.token_audience
        )

        pub_key = os.environ.get("LTI1P3_PUBLIC_KEY", None)
        priv_key = os.environ.get("LTI1P3_PRIVATE_KEY", None)

        if pub_key and priv_key:
            reg.set_tool_private_key(priv_key).set_tool_public_key(pub_key)
        else:
            raise Exception(
                "No LTI 1.3 keys found. Set LTI1P3_PUBLIC_KEY and LTI1P3_PRIVATE_KEY in .env"
            )
        return reg

    # override and always return a Deployment object since we aren't
    # explicitly tracking deployments in the database
    async def find_deployment_by_params(
        self, iss: str, deployment_id: str, client_id: str, *args, **kwargs
    ):
        d = Deployment().set_deployment_id(deployment_id)
        return d

    # These two are hardcoded backwards compatibility shims
    def check_iss_has_one_client(self, iss):
        return False

    def check_iss_has_many_clients(self, iss):
        return True

    async def get_jwks(self, iss: str = None, client_id: str = None, **kwargs):
        keys = []
        key_data = os.environ.get("LTI1P3_PUBLIC_KEY", None)
        if not key_data:
            raise Exception(
                "No LTI 1.3 keys found. Set LTI1P3_PUBLIC_KEY and LTI1P3_PRIVATE_KEY in .env"
            )
        keys.append(Registration.get_jwk(key_data))
        return {"keys": keys}
