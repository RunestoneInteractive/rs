/* Donate page (admin/auth/donate.html) — renders the PayPal buttons.
   The PayPal SDK script is loaded by the template before this file. */

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
                window.location.href = "/ns/course/index";
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
