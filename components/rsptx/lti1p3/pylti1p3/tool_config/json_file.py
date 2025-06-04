import typing as t
import json
import os

from .dict import ToolConfDict, TIssConf, TJsonData


class ToolConfJsonFile(ToolConfDict):
    _configs_dir: str

    def __init__(self, config_file: str):
        """
        config_file contains JSON with issuers settings.
        Each key is issuer and value is issuer's configuration.
        Configuration could be set in two formats:

        1. { ... "iss": { ... "client_id: "client" ... }, ... }
        In this case the library will work in the concept: one issuer ~ one client-id

        2. { ... "iss": [ { ... "client_id: "client1" ... }, { ... "client_id: "client2" ... } ], ... }
        In this case the library will work in concept: one issuer ~ many client-ids

        Example:
            {
                "iss1": [{
                        "default": true,
                        "client_id": "client_id1",
                        "auth_login_url": "auth_login_url1",
                        "auth_token_url": "auth_token_url1",
                        "auth_audience": null,
                        "key_set_url": "key_set_url1",
                        "key_set": null,
                        "private_key_file": "private.key",
                        "public_key_file": "public.key",
                        "deployment_ids": ["deployment_id1", "deployment_id2"]
                    }, {
                        "default": false,
                        "client_id": "client_id2",
                        "auth_login_url": "auth_login_url2",
                        "auth_token_url": "auth_token_url2",
                        "auth_audience": null,
                        "key_set_url": "key_set_url2",
                        "key_set": null,
                        "private_key_file": "private.key",
                        "public_key_file": "public.key",
                        "deployment_ids": ["deployment_id3", "deployment_id4"]
                    }],
                "iss2": [ .... ]
            }

        default (bool) - this iss config will be used in case if client-id was not passed on the login step
        client_id - this is the id received in the 'aud' during a launch
        auth_login_url - the platform's OIDC login endpoint
        auth_token_url - the platform's service authorization endpoint
        auth_audience - the platform's OAuth2 Audience (aud). Is used to get platform's access token,
                        Usually the same as "auth_token_url" but in the common case could be a different url
        key_set_url - the platform's JWKS endpoint
        key_set - in case if platform's JWKS endpoint somehow unavailable you may paste JWKS here
        private_key_file - relative path to the tool's private key
        public_key_file - relative path to the tool's public key
        deployment_ids (list) - The deployment_id passed by the platform during launch
        """
        if not os.path.isfile(config_file):
            raise Exception("LTI tool config file not found: " + config_file)
        self._configs_dir = os.path.dirname(config_file)

        with open(config_file, encoding="utf-8") as cfg:
            iss_conf_dict: TJsonData = json.loads(cfg.read())
            super().__init__(iss_conf_dict)

        for iss in iss_conf_dict:
            if isinstance(iss_conf_dict[iss], list):
                for iss_conf in iss_conf_dict[iss]:
                    client_id = t.cast(TIssConf, iss_conf).get("client_id")
                    self._process_iss_conf_item(
                        t.cast(TIssConf, iss_conf), iss, client_id
                    )
            else:
                self._process_iss_conf_item(t.cast(TIssConf, iss_conf_dict[iss]), iss)

    def _process_iss_conf_item(
        self, iss_conf: TIssConf, iss: str, client_id: t.Optional[str] = None
    ):
        private_key_file = iss_conf.get("private_key_file")
        if not private_key_file:
            raise Exception("iss config error: private_key_file not found")

        if not private_key_file.startswith("/"):
            private_key_file = self._configs_dir + "/" + private_key_file

        with open(private_key_file, encoding="utf-8") as prf:
            self.set_private_key(iss, prf.read(), client_id=client_id)

        public_key_file = iss_conf.get("public_key_file", None)
        if public_key_file:
            if not public_key_file.startswith("/"):
                public_key_file = self._configs_dir + "/" + public_key_file

            with open(public_key_file, encoding="utf-8") as pubf:
                self.set_public_key(iss, pubf.read(), client_id=client_id)
