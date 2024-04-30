
# *********
# |docname|
# *********
# Copyright (C) 2011  Bradley N. Miller
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
__author__ = "jaltekruse"

from docutils import nodes
from runestone.server.componentdb import (
    addQuestionToDB,
    addHTMLToDB,
    maybeAddToAssignment,
)
from runestone.common.runestonedirective import (
    RunestoneIdDirective,
    RunestoneIdNode,
)


def setup(app):
    app.add_directive("doenet", DoenetDirective)
    app.add_node(DoenetNode, html=(visit_doenet_html, depart_doenet_html))


TEMPLATE_START = """
            <div class=\"runestone\" data-component=\"doenet\" id=\"${questionId}\">
                <div class="doenetml-applet">
                    <script type="text/doenetml">
"""

TEMPLATE_END = """
                    </script>
                </div>
            </div>
"""


class DoenetNode(nodes.General, nodes.Element, RunestoneIdNode):
    pass


# self for these functions is an instance of the writer class.  For example
# in html, self is sphinx.writers.html.SmartyPantsHTMLTranslator
# The node that is passed as a parameter is an instance of our node class.
def visit_doenet_html(self, node):

    node["delimiter"] = "_start__{}_".format(node["runestone_options"]["divid"])

    self.body.append(node["delimiter"])

    res = TEMPLATE_START % node["runestone_options"]
    self.body.append(res)


def depart_doenet_html(self, node):
    res = TEMPLATE_END % node["runestone_options"]
    self.body.append(res)

    addHTMLToDB(
        node["runestone_options"]["divid"],
        node["runestone_options"]["basecourse"],
        "".join(self.body[self.body.index(node["delimiter"]) + 1 :]),
    )

    self.body.remove(node["delimiter"])


class DoenetDirective(RunestoneIdDirective):
    """
    <!-- .. doenet:: doenet-1
    -->
    1+3000=<answer>4</answer>
    """

    required_arguments = 1
    optional_arguments = 1
    has_content = True
    option_spec = RunestoneIdDirective.option_spec.copy()

    def run(self):
        super(DoenetDirective, self).run()
        addQuestionToDB(self)

        doenet_node = DoenetNode()
        doenet_node["runestone_options"] = self.options
        self.add_name(doenet_node)  # make this divid available as a target for :ref:

        maybeAddToAssignment(self)

        return [doenet_node]
