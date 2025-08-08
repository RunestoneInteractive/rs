from html import escape  # type: ignore
import json
import typing as t


class CookiesAllowedCheckPage:
    _params: t.Mapping[str, str] = {}
    _protocol: str = "http"
    _main_text: str = ""
    _click_text: str = ""
    _loading_text: str = ""

    def __init__(
        self,
        params: t.Mapping[str, str],
        protocol: str,
        main_text: str,
        click_text: str,
        loading_text: str,
        *args,
        **kwargs
    ):
        # pylint: disable=unused-argument
        self._params = params
        self._protocol = protocol
        self._main_text = main_text
        self._click_text = click_text
        self._loading_text = loading_text

    def get_css_block(self) -> str:
        css_block = """\
        body {
        font-family: Geneva, Arial, Helvetica, sans-serif;
        padding: 20px;
        }
        """
        return css_block

    def get_js_block(self) -> str:
        js_block = """\
        var siteProtocol = '%s';
        var urlParams = %s;
        var htmlEntities = {
            "&lt;": "<",
            "&gt;": ">",
            "&amp;": "&",
            "&quot;": '"',
            "&#x27;": "'"
        };

        function unescapeHtmlEntities(str) {
            for (var htmlCode in htmlEntities) {
                str = str.replace(new RegExp(htmlCode, "g"), htmlEntities[htmlCode]);
            }
            return str;
        }

        function getUpdatedUrl() {
            var newSearchParams = [];
            for (var key in urlParams) {
                if (window.location.search.indexOf(key + '=') === -1) {
                    newSearchParams.push(key + '=' + encodeURIComponent(unescapeHtmlEntities(urlParams[key])));
                }
            }
            var searchParamsStr = newSearchParams.join('&');
            if (window.location.search !== '') {
                searchParamsStr = window.location.search + '&' + searchParamsStr;
            } else {
                searchParamsStr = '?' + searchParamsStr;
            }
            return window.location.protocol + '//' + window.location.hostname +
                (window.location.port ? (":" + window.location.port) : "") +
                window.location.pathname + searchParamsStr;
        }

        function displayLoadingBlock() {
            document.getElementById("lti1p3-loading-msg").style.display = "block";
        }

        function displayWarningBlock() {
            document.getElementById("lti1p3-warning-msg").style.display = "block";
            var newTabLink = document.getElementById("lti1p3-new-tab-link");
            var contentUrl = getUpdatedUrl();
            newTabLink.onclick = function() {
                window.open(contentUrl , '_blank');
                newTabLink.parentNode.removeChild(newTabLink);
            };
        }

        function checkCookiesAllowed() {
            var cookie = "lti1p3_test_cookie=1; path=/";
            if (siteProtocol === 'https') {
                cookie = cookie + '; SameSite=None; secure';
            }
            document.cookie = cookie;
            var res = document.cookie.indexOf("lti1p3_test_cookie") !== -1;
            if (res) {
                // remove test cookie and reload page
                document.cookie = "lti1p3_test_cookie=1; expires=Thu, 01-Jan-1970 00:00:01 GMT";
                displayLoadingBlock();
                window.location.href = getUpdatedUrl();
            } else {
                displayWarningBlock();
            }
        }

        document.addEventListener("DOMContentLoaded", checkCookiesAllowed);
        """
        # pylint: disable=deprecated-method
        js_block = js_block % (
            self._protocol,
            json.dumps({k: escape(v, True) for k, v in self._params.items()}),
        )
        return js_block

    def get_header_block(self) -> str:
        return ""

    def get_html(self) -> str:
        html = """\
        <!DOCTYPE html>
        <html lang="en">
        <head>
        <title></title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/5.3.0/css/bootstrap.min.css"/>
        <meta charset="UTF-8">
        <style type="text/css">
        {css_block}
        </style>
        <script type="text/javascript">
        {js_block}
        </script>
        </head>
        <body>
        <div id="lti1p3-loading-msg" style="display: none;">
        {loading_text}
        </div>
        <div id="lti1p3-warning-msg" style="display: none;">
        {header_block}
        <p><strong>{main_text}</strong></p>
        <p>You can either try to:</p>
        <ul>
            <li>Enable third-party cookies in your browser settings and reload this page. (Look for a setting for "third-party cookies" (Chrome) or "enable cross site tracking" (Safari) or "enhanced tracking protection" (Firefox).)</li>
            <li>Open the content in a new tab: <a href="javascript: void(0);" id="lti1p3-new-tab-link">{click_text}</a></li>
            </ul>
            <div class="alert alert-info" role="alert">
            <p>
                <strong>Students:</strong> Most Runestone Academy content works best in its own window (and not embedded within another site). It is recommended you open the content in a new tab.
            </p>
            </div>
            <div class="alert alert-warning" role="alert">
            <p>
                <strong>Instructors:</strong> If you are an instructor trying to link content, you should first try to enable third party cookies. Opening the "Select Content" page in a new tab may not work correctly.
            </p>
            </div>
        </div>
        </body>
        </html>
        """
        html = html.format(
            css_block=self.get_css_block(),
            js_block=self.get_js_block(),
            loading_text=self._loading_text,
            header_block=self.get_header_block(),
            main_text=self._main_text,
            click_text=self._click_text,
        )
        return html
