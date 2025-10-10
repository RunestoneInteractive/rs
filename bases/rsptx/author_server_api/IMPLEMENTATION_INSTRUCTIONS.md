# Implementation Instructions for Git Commit Hash Display

This document provides instructions on how to integrate the git commit hash functionality into the Runestone author server to address issue #733.

## Files Added

### 1. git_utils.py
This module provides utility functions for retrieving the current git commit hash using multiple fallback methods:
- Environment variable `GIT_COMMIT_HASH` (useful for CI/CD)
- Git command execution 
- Reading from `.git` directory files

## Integration Required

### 1. Modify main.py

Add the following import after the existing Local App imports:

```python
from rsptx.author_server_api.git_utils import get_git_commit_info
```

Add a new API endpoint before the final endpoint:

```python
@app.get("/author/commit_info")
async def get_commit_info(request: Request, user=Depends(auth_manager)):
    """
    Get git commit hash information for debugging purposes.
    
    This endpoint returns the current git commit hash that the server was built from,
    helping with debugging and version tracking as requested in issue #733.
    """
    commit_info = get_git_commit_info()
    return JSONResponse(commit_info)
```

Modify the home endpoint to include commit info in the template context. Find the `@app.get("/author/")` endpoint and update it:

```python
@app.get("/author/")
async def home(request: Request, user=Depends(auth_manager)):
    print(f"{request.state.user} OR user = {user}")
    course = await fetch_course(user.course_name)
    if user:
        if not await is_author(user.id):
            return RedirectResponse(url="/notauthorized")
    if user:
        name = user.first_name
        book_list = await fetch_books_by_author(user.username)
        book_list = [b.Library for b in book_list if b.Library is not None]
    else:
        name = "unknown person"
        book_list = []
        # redirect them back somewhere....
    
    # Add git commit info for debugging
    git_info = get_git_commit_info()
    
    return templates.TemplateResponse(
        "author/home.html",
        context={
            "request": request,
            "name": name,
            "book_list": book_list,
            "course": course,
            "git_commit_info": git_info,  # Add this line
        },
    )
```

### 2. Template Updates (Future)

To display the commit hash in the Author Tools page, the `author/home.html` template would need to be updated to include:

```html
{% if git_commit_info.available %}
<div class="commit-info" style="margin-top: 20px; padding: 10px; background-color: #f8f9fa; border-radius: 4px; border-left: 4px solid #007bff;">
    <h6 style="margin-bottom: 5px; color: #495057;">Build Version Info</h6>
    <small style="font-family: monospace; color: #6c757d;">
        Built from commit: <strong>{{ git_commit_info.hash }}</strong> 
        (source: {{ git_commit_info.source }})
    </small>
</div>
{% endif %}
```

### 3. Book Server Integration (Future Enhancement)

For embedding the commit hash in books themselves, similar integration would be needed in:
- `bases/rsptx/book_server_api/main.py`
- Book building processes in the worker functions
- Book templates to display version info

## Environment Variable Support

For production deployments, set the `GIT_COMMIT_HASH` environment variable during the build process:

```bash
# In your build script or CI/CD pipeline
export GIT_COMMIT_HASH=$(git rev-parse --short HEAD)
```

This ensures the commit hash is available even when the `.git` directory is not present in production containers.

## API Usage

Once implemented, the commit info will be available via:
- GET `/author/commit_info` - Returns JSON with git commit information
- Author home page will display the commit hash in the UI

## Testing

To test the functionality:
1. Check the API endpoint: `curl http://localhost:8000/author/commit_info`
2. Visit the author home page to see the commit hash displayed
3. Test with environment variable: `GIT_COMMIT_HASH=abc1234 python -m uvicorn main:app`

## Benefits

- **Debugging**: Easily identify which version of the code is running
- **Version tracking**: Know exactly what commit books were built from
- **Cache troubleshooting**: Identify when servers haven't been updated
- **Multiple fallbacks**: Works in development, CI/CD, and production environments
