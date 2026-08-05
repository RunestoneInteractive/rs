/* Donate page (admin/auth/donate.html) — renders the PayPal buttons.
   The PayPal SDK script is loaded by the template before this file. */

/* Where to go once the reader is done here. The server puts it on the card as
   data-next when they are passing through on the way somewhere else — an LTI
   launch by a new enrollment heading for an assignment, say. Only same-site
   paths are accepted: the value reaches the server from a query string, and the
   server already filters it, but this is the last hop before a navigation. */
function continueUrl() {
    const card = document.querySelector(".donate-card");
    const next = card && card.dataset.next;
    if (next && next.startsWith("/") && !next.startsWith("//")) {
        return next;
    }
    return "/ns/course/index";
}

const fundingSources = [
    paypal.FUNDING.PAYPAL,
    paypal.FUNDING.VENMO,
    paypal.FUNDING.CARD,
];

for (const fundingSource of fundingSources) {
    const paypalButtonsComponent = paypal.Buttons({
        fundingSource: fundingSource,

        // optional styling for buttons
        // https://developer.paypal.com/docs/checkout/standard/customize/buttons-style-guide/
        style: {
            shape: "rect",
            height: 40,
        },

        // set up the transaction
        createOrder: (data, actions) => {
            var amt_opts = document.getElementsByName("donate");
            var amt = "";
            for (let rb of amt_opts) {
                if (rb.type === "radio" && rb.checked) {
                    amt = rb.value;
                }
            }
            if (amt === "") {
                amt = document.getElementById("donateother").value;
                let amtFloat = parseFloat(amt);
                // amounts under a dollar are not worth processing
                if (isNaN(amtFloat) || amtFloat < 1.0) {
                    alert("Sorry we cannot accept donations under $1");
                    return;
                }
            }
            const createOrderPayload = {
                purchase_units: [
                    {
                        amount: {
                            value: amt,
                        },
                    },
                ],
            };

            return actions.order.create(createOrderPayload);
        },

        // finalize the transaction
        onApprove: (data, actions) => {
            const captureOrderHandler = (details) => {
                fetch("/admin/auth/donate/mark", { method: "POST" });
                alert("Payment successful - Thank you! ");
                window.location.href = continueUrl();
                console.log("Transaction completed!");
            };

            return actions.order.capture().then(captureOrderHandler);
        },

        // handle unrecoverable errors
        onError: (err) => {
            console.error("An error prevented the buyer from checking out with PayPal");
        },
    });

    if (paypalButtonsComponent.isEligible()) {
        paypalButtonsComponent.render("#paypal-button-container").catch((err) => {
            console.error("PayPal Buttons failed to render");
        });
    } else {
        console.log("The funding source is ineligible");
    }
}

// Pre-select an amount if provided as ?amt=NN
document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const amt = params.get("amt");
    if (amt) {
        const btn = document.getElementById("donate" + amt);
        if (btn) {
            btn.checked = true;
        }
    }
});
