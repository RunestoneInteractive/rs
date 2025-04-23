from os import environ
# Needed to prevent Web2py's custom importer from trying to find the openai module in the app
from gluon.custom_import import INVALID_MODULES
INVALID_MODULES.add("openai")
import openai

openai.api_key = environ.get("OPENAI_API_KEY")
if not openai.api_key:
    raise RuntimeError("Missing OpenAI API key. Set the OPENAI_API_KEY environment variable.")