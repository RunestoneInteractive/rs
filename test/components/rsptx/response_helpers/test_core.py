from rsptx.response_helpers import core


def test_sample():
    assert core is not None


class _Course:
    course_name = "mycourse"
    base_course = "mybook"


def test_prepare_question_htmlsrc_empty():
    assert core.prepare_question_htmlsrc(None, _Course()) is None
    assert core.prepare_question_htmlsrc("", _Course()) is None


def test_prepare_question_htmlsrc_rewrites_paths():
    src = (
        '<img src="../_static/a.png"><img src="../_images/b.png">'
        '<div data-knowl="./k.html"></div><iframe src="x"/>'
    )
    out = core.prepare_question_htmlsrc(src, _Course())
    assert 'src="/ns/books/published/mycourse/_static/a.png"' in out
    assert 'src="/ns/books/published/mycourse/_images/b.png"' in out
    assert 'data-knowl="/ns/books/published/mybook/k.html"' in out
    assert '<iframe src="x">  </iframe>' in out


def test_prepare_question_htmlsrc_unescapes_fitb_json():
    src = '<div data-component="fillintheblank"><script type="application/json">{"a": "&lt;b&gt;"}</script></div>'
    out = core.prepare_question_htmlsrc(src, _Course())
    assert '{"a": "<b>"}' in out
