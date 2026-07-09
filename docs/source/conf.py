# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html
import os
import sys
import warnings

from sqlalchemy.exc import SAWarning

# The path here is relative to
sys.path.insert(0, os.path.abspath("../../components/rsptx"))
sys.path.insert(0, os.path.abspath("../../bases/rsptx"))

# autodoc introspects every class attribute with getattr(); on the declarative
# mixins in db.models (AnswerMixin etc.) that touches @declared_attr
# descriptors on non-mapped classes, which SQLAlchemy warns about. Harmless
# during doc builds, so silence just that message.
warnings.filterwarnings(
    "ignore", message="Unmanaged access of declarative attribute", category=SAWarning
)

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = "Runestone Documentation"
copyright = "2023, Brad Miller"
author = "Brad Miller"
release = "6.6.0"

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = ["sphinx.ext.todo", "sphinx.ext.autodoc", "sphinx_click.ext"]

templates_path = ["_templates"]
exclude_patterns = []


# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = "bizstyle"
html_theme_options = {"rightsidebar": "true", "sidebarwidth": "30%"}

html_static_path = ["_static"]
