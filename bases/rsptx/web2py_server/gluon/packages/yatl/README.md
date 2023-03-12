# Yet Another Template Language

This is the web2py template language described [here](http://web2py.com/books/default/chapter/29/05/the-views) made available as stand alone package so it can be used anywhere.

Basically it is pure Python within "{{" ... "}}" delimiters and blocks are terminated with "pass" if termination is not obvious. There is no indentation constraints.

For example:

```
from yatl import render, SPAN

example = """
<div> 
{{ for k in range(num): }}
<span>{{=SPAN(k, _class='number')}} is {{if k % 2 == 0:}}even{{else:}}odd{{pass}}</span>
{{ pass }}
</div>
"""

print(render(example, context=dict(num=10, SPAN=SPAN), delimiters="{{ }}"))
```

In the example SPAN is an optional helper.
Output is escaped by default unless marked up with the XML helper as in {{=XML('1 < 2')}}.
Note that the helpers included here are similar but not identical to the web2py ones.
They are 99% compatible but the implementation is different.

Any Python expressions is allowed in templates, including function and class defintions:

```
example = """
{{ def link(x): }}<a href="{{=x}}">{{=x}}</a>{{ pass }}
<ul>
  {{ for k in range(num): }}
  <li>
     {{= link('http://example.com/%s' % k) }}
  </li>
  {{ pass }}
</ul>
"""

print(render(example, context=dict(num=10), delimiters="{{ }}"))
```

## Caching

If you implement a caching reader as the one below, you mak yatl even faster:

```
CACHE = {}
def reader(filename):
    if filename in CACHE:
        return CACHE[filename]
    with open(filename) as fp;
        CACHE[filename] = content = fp.read()
    return content
      
output = yatl.render(reader(filename), path=path, reader=reader)
```

