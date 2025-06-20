About lti1p3 component
==============================

Code in the `pylti1p3` folder is adapted from https://github.com/dmitry-viskov/pylti1.3
and used under MIT license. That project no longer appears to be maintained, so
we are locally maintaining our own copy of the code.

As much as possible, code in that directory has been kept as generic as possible. (i.e. does not have Runestone specific modifications.)

Changes from original:

* Add contrib/fastapi and remove contrib/flask and contrib/django
* Modify to be compatibile with async.  Network requests and cache access need to be
  non-blocking, so all functions that hit those were rewritten to be async
* Integrate various bug-fix PRs in the dmitry-viskov github repo that have
  not been merged.
* Assorted other fixes and additions.

All code outside of `pylti1p3` is RS specific.