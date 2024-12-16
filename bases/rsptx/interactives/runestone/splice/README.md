# SPLICE integration

See [SPLICE Content Protocol](https://docs.google.com/document/d/1X6Vx6Em67t8Vp4Vecnmc-7OblVewJJKDFIJUrvRAvdc/edit?pli=1&tab=t.0#heading=h.r0syp685x130)

The Runestone approach for SPLICE components.

1. They are in iframes
2. The use the above protocol to send scores and save state
3. We save the state
4. SPLICE actively asks for the state back and we just hand it to them we don't really care about the actual contents of the state.

