/* nav.js — Runestone's replacement for the Bootstrap JavaScript bundle.
   Loaded by _base.html and admin/auth/_auth_base.html.

   Implements the small set of behaviors our templates (and the book
   component bundles loaded on assignment pages) actually used from
   Bootstrap:

     - data-toggle="dropdown"  navbar dropdown menus
     - data-toggle="collapse"  mobile navbar hamburger, profile delete form
     - data-dismiss="alert"    dismissible alerts
     - data-toggle="tab"       tabbedStuff book component
     - $.fn.modal shim         activecode assignment feedback dialog
*/
(function () {
    "use strict";

    function closeAllDropdowns() {
        document
            .querySelectorAll(".dropdown-menu.show")
            .forEach((menu) => menu.classList.remove("show"));
        // Bootstrap 3 plugins from book bundles mark the open state on the
        // parent element instead
        document
            .querySelectorAll(".dropdown.open, .nav-item.open")
            .forEach((el) => el.classList.remove("open"));
    }

    function showTab(toggle) {
        // Deactivate siblings within the enclosing nav, activate this tab
        const nav = toggle.closest(".nav-tabs, .nav");
        if (nav) {
            nav.querySelectorAll(".active").forEach((el) =>
                el.classList.remove("active")
            );
        }
        toggle.classList.add("active");
        if (toggle.parentElement && toggle.parentElement.tagName === "LI") {
            toggle.parentElement.classList.add("active");
        }

        const paneSelector = toggle.getAttribute("href") || toggle.dataset.target;
        const pane = paneSelector && document.querySelector(paneSelector);
        if (pane && pane.parentElement) {
            pane.parentElement
                .querySelectorAll(":scope > .tab-pane.active")
                .forEach((el) => el.classList.remove("active"));
            pane.classList.add("active");
        }

        // tabbedStuff listens for Bootstrap's shown.bs.tab jQuery event
        if (window.jQuery) {
            window.jQuery(toggle).trigger("shown.bs.tab");
        }
    }

    document.addEventListener("click", function (e) {
        const dropdownToggle = e.target.closest('[data-toggle="dropdown"]');
        if (dropdownToggle) {
            e.preventDefault();
            const parent = dropdownToggle.parentElement;
            const menu = parent && parent.querySelector(".dropdown-menu");
            if (menu) {
                const wasOpen = menu.classList.contains("show");
                closeAllDropdowns();
                if (!wasOpen) {
                    menu.classList.add("show");
                }
            }
            return;
        }

        // Any other click closes open dropdowns (clicking a dropdown-item
        // is a navigation, so closing is fine there too)
        closeAllDropdowns();

        const collapseToggle = e.target.closest('[data-toggle="collapse"]');
        if (collapseToggle) {
            const targetSel =
                collapseToggle.dataset.target ||
                collapseToggle.getAttribute("href");
            const target = targetSel && document.querySelector(targetSel);
            if (target) {
                e.preventDefault();
                target.classList.toggle("show");
            }
            return;
        }

        const tabToggle = e.target.closest('[data-toggle="tab"]');
        if (tabToggle) {
            e.preventDefault();
            showTab(tabToggle);
            return;
        }

        const alertDismiss = e.target.closest('[data-dismiss="alert"]');
        if (alertDismiss) {
            const alertBox = alertDismiss.closest(".alert");
            if (alertBox) {
                alertBox.remove();
            }
            return;
        }

        const modalDismiss = e.target.closest('[data-dismiss="modal"]');
        if (modalDismiss) {
            const modal = modalDismiss.closest(".modal");
            if (modal) {
                hideModal(modal);
            }
        }
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            closeAllDropdowns();
            document
                .querySelectorAll(".modal.show")
                .forEach((modal) => hideModal(modal));
        }
    });

    /* ----- minimal modal implementation ----- */

    function showModal(el) {
        if (!el.parentNode) {
            document.body.appendChild(el);
        }
        el.style.display = "block";
        el.classList.add("show");
        document.body.classList.add("modal-open");

        if (!el._rsBackdrop) {
            const backdrop = document.createElement("div");
            backdrop.className = "modal-backdrop";
            document.body.appendChild(backdrop);
            el._rsBackdrop = backdrop;
        }

        // Clicking outside the dialog closes the modal
        el.addEventListener("mousedown", function (e) {
            if (e.target === el) {
                hideModal(el);
            }
        });
    }

    function hideModal(el) {
        el.style.display = "none";
        el.classList.remove("show");
        document.body.classList.remove("modal-open");
        if (el._rsBackdrop) {
            el._rsBackdrop.remove();
            el._rsBackdrop = null;
        }
    }

    // jQuery plugin shim: book component bundles (activecode assignment
    // feedback) call $(html).modal()
    if (window.jQuery && !window.jQuery.fn.modal) {
        window.jQuery.fn.modal = function (action) {
            return this.each(function () {
                if (action === "hide") {
                    hideModal(this);
                } else {
                    showModal(this);
                }
            });
        };
    }
})();
