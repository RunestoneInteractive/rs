from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

from rsptx.db.crud import fetch_library_books
from rsptx.templates import template_folder

app = FastAPI()

templates = Jinja2Templates(directory=template_folder)
import pdb


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    res = await fetch_library_books()
    return templates.TemplateResponse(
        "library/library.html", {"request": request, "books": res}
    )
