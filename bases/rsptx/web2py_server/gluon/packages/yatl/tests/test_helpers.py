from yatl.helpers import TAG, XML, DIV, SPAN
import unittest


class TestHelpers(unittest.TestCase):
    def test_tags(self):
        DIV = TAG.div
        IMG = TAG['img/']
        self.assertEqual(DIV().xml(), "<div></div>")
        self.assertEqual(IMG().xml(), "<img/>")
        self.assertEqual(DIV(_id="my_id").xml(), "<div id=\"my_id\"></div>")
        self.assertEqual(IMG(_src="crazy").xml(), "<img src=\"crazy\"/>")
        self.assertEqual(
            DIV(_class="my_class", _mytrueattr=True).xml(),
            "<div class=\"my_class\" mytrueattr=\"mytrueattr\"></div>")
        self.assertEqual(
            DIV(_id="my_id", _none=None, _false=False, without_underline="serius?").xml(),
            "<div id=\"my_id\"></div>")
        self.assertEqual(
            DIV("<b>xmlscapedthis</b>").xml(), "<div>&lt;b&gt;xmlscapedthis&lt;/b&gt;</div>")
        self.assertEqual(
            DIV(XML("<b>don'txmlscapedthis</b>")).xml(), "<div><b>don'txmlscapedthis</b></div>")

    def test_invalid_atribute_name(self):
        i = [" ", "=", "'", '"', ">", "<", "/"]
        for x in i:
            DIV = TAG.div
            b = "_any%sthings" % x
            attr = {b: "invalid_atribute_name"}
            self.assertRaises(ValueError, DIV("any content", **attr).xml)

    def test_amend(self):
        div = DIV('hello', _class='myclass')
        div = div.amend('hello world', _id='myid')
        self.assertEqual(
            div.xml(),
            '<div class="myclass" id="myid">hello world</div>')

    def test_sanitize(self):
        permitted_tags=[
            'div',
            'td',
            'b',
            'br/',
            'strong',
            'span',
            'img/',
            'a',
        ]
        allowed_attributes={
            'a': ['href', 'title'],
            'img': ['src', 'alt'],
            'blockquote': ['type'],
            'td': ['colspan'],
        }
        # test permitted
        for x in permitted_tags:
            T = TAG[x]
            s_tag = T().xml()
            if x == "img/": # alt or src attribute is required. src has to have a valid href
                s_tag = T(_alt="empty").xml()
                self.assertEqual(XML(s_tag, sanitize=True, permitted_tags=['img/'], allowed_attributes={'img': ['src', 'alt']}).xml(),
                    "<img alt=\"empty\"/>")
                s_tag = T(_src="/image.png").xml()
                self.assertEqual(XML(s_tag, sanitize=True, permitted_tags=['img/'], allowed_attributes={'img': ['src', 'alt']}).xml(),
                    "<img src=\"/image.png\"/>")
            elif x == "a": # It has to have a valid href or title or not tag empty 
                s_tag = T("this is a link", _href="http://web2py.com/").xml()
                self.assertEqual(XML(s_tag, sanitize=True, permitted_tags=['a'], allowed_attributes={'a': ['href', 'title']}).xml(),
                    "<a href=\"http://web2py.com/\">this is a link</a>")
                s_tag = T("without href", _title="this is a link?").xml()
                self.assertEqual(XML(s_tag, sanitize=True, permitted_tags=['a'], allowed_attributes={'a': ['href', 'title']}).xml(),
                    '<a title="this is a link?">without href</a>')
                s_tag = T(_title="empty_tag").xml()
                self.assertEqual(XML(s_tag, sanitize=True, permitted_tags=['a'], allowed_attributes={'a': ['href', 'title']}).xml(),
                    '<a title="empty_tag"></a>')
            else:
                self.assertEqual(XML(s_tag, sanitize=True, permitted_tags=permitted_tags, allowed_attributes=allowed_attributes).xml(), "<%s></%s>" %
                    (x, x) if not x[-1] == "/" else "<%s>" % x)
        
        # test tag out of list
        out_of_list = [
            'blockquote', 'i', 'li', 'ol', 'ul', 'p', 'cite', 'code', 'pre',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'table', 'tbody', 'thead', 'tfoot', 'tr'
            'strong']
        for x in out_of_list:
            T = TAG[x]
            self.assertEqual(XML(T().xml(), sanitize=True, permitted_tags=permitted_tags, allowed_attributes=allowed_attributes).xml(), "&lt;%s&gt;&lt;/%s&gt;" %
                (x, x))
        # test unusual tags
        for x in ["evil", "n0c1v3"]:
            T = TAG[x]
            self.assertEqual(XML(T().xml(), sanitize=True, permitted_tags=permitted_tags, allowed_attributes=allowed_attributes).xml(), "&lt;%s&gt;&lt;/%s&gt;" %
                (x, x))
        # test allowed_attributes
        s_tag = TAG['td']("content_td", _colspan="2", _extra_attr="invalid").xml()
        self.assertEqual(XML(s_tag, sanitize=True, permitted_tags=['td'], allowed_attributes={'td': ['colspan']}).xml(),
            '<td colspan="2">content_td</td>')
        s_tag = TAG['a']("link", _href="http://web2py.com/", _title="my_title").xml()
        self.assertEqual(XML(s_tag, sanitize=True, permitted_tags=['a'], allowed_attributes={'a': ['href', 'title']}).xml(),
            '<a href="http://web2py.com/" title="my_title">link</a>')
        s_tag = TAG['img/'](_alt="empty", _src="/images/logo.png").xml()
        self.assertEqual(XML(s_tag, sanitize=True, permitted_tags=['img/'], allowed_attributes={'img': ['src', 'alt']}).xml(),
            '<img src="/images/logo.png" alt="empty"/>')
        s_tag = TAG['div']("content", _style="{backgrond-color: red;}").xml()
        self.assertEqual(XML(s_tag, sanitize=True, permitted_tags=['div'], allowed_attributes={'div': ['style']}).xml(),
            '<div style="{backgrond-color: red;}">content</div>')
        self.assertEqual(XML(TAG['a']("oh no!", _href="invalid_link").xml(), sanitize=True, permitted_tags=['a']).xml(), 'oh no!')
        self.assertEqual(XML(TAG['div']("", _onclick="evil()").xml(), sanitize=True, permitted_tags=['div']).xml(), '<div></div>')

        # valid inside invalid
        s_tag = TAG['evil'](TAG['div']('valid'), _style="{backgrond-color: red;}").xml()
        self.assertEqual(XML(s_tag, sanitize=True, permitted_tags=['div'], allowed_attributes={'div': ['style']}).xml(),
            '&lt;evil&gt;<div>valid</div>&lt;/evil&gt;')
        self.assertEqual(XML(TAG['a'](TAG['img/'](_src="/index.html"), _class="teste").xml(), sanitize=True, permitted_tags=['a', 'img/']).xml(), '<img src="/index.html"/>')

        # tags deleted even allowed
        self.assertEqual(XML(TAG['img/']().xml(), sanitize=True, permitted_tags=['img']).xml(), "")
        self.assertEqual(XML(TAG['img/'](_src="invalid_url").xml(), sanitize=True, permitted_tags=['img']).xml(), "")
        self.assertEqual(XML(TAG['img/'](_class="teste").xml(), sanitize=True, permitted_tags=['img']).xml(), "")
        self.assertEqual(XML(TAG['a'](_href="invalid_link").xml(), sanitize=True, permitted_tags=['a']).xml(), "")

    def test_find(self):
        a = DIV('A', _class='a')
        b = SPAN('B', _id='b')
        div = DIV(DIV(a), DIV(b))
        self.assertEqual(div.find('.a')[0], a)
        self.assertEqual(div.find('#b')[0], b)
        self.assertEqual(div.find('div.a')[0], a)
        self.assertEqual(div.find('span#b')[0], b)
        self.assertEqual(div.find('span')[0], b)
        self.assertEqual(len(div.find('div')), 4)
        self.assertEqual(len(div.find('abc')), 0)

if __name__ == '__main__':
    unittest.main()
