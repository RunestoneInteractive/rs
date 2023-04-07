# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html
import os
import sys

# The path here is relative to
sys.path.insert(0, os.path.abspath("../../components/rsptx"))
sys.path.insert(0, os.path.abspath("../../bases/rsptx"))

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = "Runestone Documentation"
copyright = "2023, Brad Miller"
author = "Brad Miller"
release = "6.6.0"

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = ["sphinx.ext.todo", "sphinx.ext.autodoc"]

templates_path = ["_templates"]
exclude_patterns = []


# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = "bizstyle"
html_theme_options = {"rightsidebar": "true", "sidebarwidth": "30%"}

html_static_path = ["_static"]
