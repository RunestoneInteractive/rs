# *******************************************************
# |docname| - LTI 1.1 Outcome (grade passback) requests
# *******************************************************
#
# Self-contained port of the ``OutcomeRequest`` / ``OutcomeResponse`` helpers
# that used to live in the web2py ``modules`` directory (originally forked from
# https://github.com/tophatmonocle/ims_lti_py).  It builds an OAuth1-signed
# ``replaceResult`` POX request and sends it to the LMS outcome service URL.
#
# Only the pieces Runestone actually uses (sending a grade back to the LMS) are
# kept here.  The parsing helpers are retained so we can report success/failure.

# Imports
# =======
# Standard library
# ----------------
from collections import defaultdict

# Third-party imports
# -------------------
import oauth2
from lxml import etree, objectify

REPLACE_REQUEST = "replaceResult"
DELETE_REQUEST = "deleteResult"
READ_REQUEST = "readResult"

_OMS_NS = "http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0"

accessors = [
    "operation",
    "score",
    "result_data",
    "outcome_response",
    "message_identifier",
    "lis_outcome_service_url",
    "lis_result_sourcedid",
    "consumer_key",
    "consumer_secret",
    "post_request",
]


class InvalidLTIConfigError(Exception):
    """Raised when an OutcomeRequest is missing required attributes."""


class OutcomeResponse:
    """Parses the POX response returned by the LMS outcome service."""

    def __init__(self, **kwargs):
        self.response_code = None
        self.code_major = None
        self.severity = None
        self.description = None
        self.message_identifier = None
        for key, val in kwargs.items():
            setattr(self, key, val)

    @staticmethod
    def from_post_response(post_response, content):
        response = OutcomeResponse()
        response.post_response = post_response
        response.response_code = getattr(post_response, "status", None)
        response.process_xml(content)
        return response

    def is_success(self):
        return self.code_major == "success"

    def process_xml(self, xml):
        try:
            root = objectify.fromstring(xml)
            header = root.imsx_POXHeader.imsx_POXResponseHeaderInfo
            self.message_identifier = str(header.imsx_messageIdentifier)
            status_node = header.imsx_statusInfo
            self.code_major = str(status_node.imsx_codeMajor)
            self.severity = str(status_node.imsx_severity)
            self.description = str(getattr(status_node, "imsx_description", ""))
        except Exception:
            # Malformed or unexpected response; leave attributes as None so the
            # caller treats it as a failure.
            pass


class OutcomeRequest:
    """
    Build & POST an OAuth-signed LTI 1.1 Outcome Request to a Tool Consumer
    (the LMS).  See
    http://www.imsglobal.org/LTI/v1p1/ltiIMGv1p1.html#_Toc319560472
    """

    def __init__(self, opts=None):
        opts = opts or defaultdict(lambda: None)
        for accessor in accessors:
            setattr(self, accessor, None)
        for key, val in opts.items():
            setattr(self, key, val)

    def post_replace_result(self, score, result_data=None):
        """POST the given score to the Tool Consumer with a replaceResult."""
        self.operation = REPLACE_REQUEST
        self.score = score
        self.result_data = result_data
        if result_data is not None:
            if len(result_data) > 1:
                raise InvalidLTIConfigError(
                    "Dictionary result_data can only have one entry. "
                    "{0} entries were found.".format(len(result_data))
                )
            if "text" not in result_data and "url" not in result_data:
                raise InvalidLTIConfigError(
                    'Dictionary result_data can only have the key "text" '
                    'or the key "url".'
                )
        return self.post_outcome_request()

    def has_required_attributes(self):
        return (
            self.consumer_key is not None
            and self.consumer_secret is not None
            and self.lis_outcome_service_url is not None
            and self.lis_result_sourcedid is not None
            and self.operation is not None
        )

    def post_outcome_request(self):
        """POST an OAuth-signed request to the Tool Consumer."""
        if not self.has_required_attributes():
            raise InvalidLTIConfigError(
                "OutcomeRequest does not have all required attributes"
            )

        consumer = oauth2.Consumer(key=self.consumer_key, secret=self.consumer_secret)
        client = oauth2.Client(consumer)

        # httplib2 (used by oauth2.Client) lower-cases the Authorization header,
        # which some LMSes reject.  Temporarily patch the normalizer to preserve
        # the canonical header name.
        import httplib2

        http = httplib2.Http
        normalize = http._normalize_headers

        def my_normalize(self, headers):
            ret = normalize(self, headers)
            if "authorization" in ret:
                ret["Authorization"] = ret.pop("authorization")
            return ret

        http._normalize_headers = my_normalize
        try:
            response, content = client.request(
                self.lis_outcome_service_url,
                "POST",
                body=self.generate_request_xml(),
                headers={"Content-Type": "application/xml"},
            )
        finally:
            http._normalize_headers = normalize

        self.outcome_response = OutcomeResponse.from_post_response(response, content)
        return self.outcome_response

    def generate_request_xml(self):
        root = etree.Element("imsx_POXEnvelopeRequest", xmlns=_OMS_NS)

        header = etree.SubElement(root, "imsx_POXHeader")
        header_info = etree.SubElement(header, "imsx_POXRequestHeaderInfo")
        version = etree.SubElement(header_info, "imsx_version")
        version.text = "V1.0"
        message_identifier = etree.SubElement(header_info, "imsx_messageIdentifier")
        message_identifier.text = self.message_identifier or "1"

        body = etree.SubElement(root, "imsx_POXBody")
        request = etree.SubElement(body, "%sRequest" % self.operation)
        record = etree.SubElement(request, "resultRecord")

        guid = etree.SubElement(record, "sourcedGUID")
        sourcedid = etree.SubElement(guid, "sourcedId")
        sourcedid.text = self.lis_result_sourcedid

        if self.score is not None:
            result = etree.SubElement(record, "result")
            result_score = etree.SubElement(result, "resultScore")
            language = etree.SubElement(result_score, "language")
            language.text = "en"
            text_string = etree.SubElement(result_score, "textString")
            text_string.text = str(self.score)

        return etree.tostring(root, xml_declaration=True, encoding="utf-8")
